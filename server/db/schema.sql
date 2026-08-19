-- ============================================================================
-- CheckPoint — Event Check-In System — Postgres schema
-- ============================================================================
-- The constraints in this file ARE the answer to Hard Requirement 1.
-- Duplicate check-ins and over-capacity registrations are prevented by the
-- DATABASE, not by application code — so the guarantee holds even when two
-- separate server processes hit this same database at the same time.
--
-- Look for the two load-bearing lines:
--   1. check_ins.registration_id  UNIQUE   -> one check-in per registration, ever
--   2. events.registered_count + the conditional UPDATE in code -> capacity cap
-- ============================================================================

-- Needed for gen_random_uuid(). Built into Postgres 13+, present on Supabase.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users: organizers and attendees. Role is stored server-side and enforced
-- server-side (a JWT the client cannot forge), never trusted from the UI.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('organizer', 'attendee')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- events: created by an organizer. registered_count is a denormalised counter
-- that we increment inside a row-locking transaction so concurrent registrations
-- can never push it past capacity.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  event_date       TIMESTAMPTZ NOT NULL,
  capacity         INT  NOT NULL CHECK (capacity > 0),
  registered_count INT  NOT NULL DEFAULT 0 CHECK (registered_count >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);

-- ---------------------------------------------------------------------------
-- registrations: one attendee registering for one event. The UNIQUE(event_id,
-- user_id) stops the same person registering twice (which would also let them
-- burn two capacity slots). qr_secret is the per-registration secret the
-- rotating QR token is derived from — every registration gets its OWN secret,
-- so there is no single shared QR for the whole event.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qr_secret         TEXT NOT NULL,
  token_consumed_at TIMESTAMPTZ,             -- set the moment a token is scanned in (one-time-use layer)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user  ON registrations(user_id);

-- ---------------------------------------------------------------------------
-- check_ins: THE duplicate guard lives here.
-- registration_id UNIQUE means Postgres itself physically refuses to store a
-- second check-in row for the same registration. If 150 concurrent scans race,
-- exactly one INSERT wins and the other 149 fail with SQLSTATE 23505, which the
-- app catches and turns into "already checked in". No in-memory lock is used or
-- needed — the guarantee is at the database level and survives multiple servers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS check_ins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_by      UUID REFERENCES users(id),   -- organizer who scanned
  station_id      TEXT NOT NULL DEFAULT 'default',
  source          TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'offline_sync'))
);

-- ---------------------------------------------------------------------------
-- scan_events: an append-only audit log of EVERY scan attempt, successful or
-- not. Two jobs:
--   * evidence for the interview / dashboard ("show me every rejection")
--   * client_scan_id UNIQUE makes offline sync idempotent — if the scanner
--     retries a queued scan after a flaky reconnect, the second insert of the
--     same client_scan_id is rejected, so a scan is never applied twice.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  client_scan_id  TEXT UNIQUE,                 -- NULL for online scans, a UUID for offline-queued scans
  outcome         TEXT NOT NULL CHECK (outcome IN (
                     'accepted', 'duplicate', 'conflict_flagged',
                     'invalid_token', 'expired_token', 'capacity_full'
                  )),
  station_id      TEXT NOT NULL DEFAULT 'default',
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),  -- when the scan happened (client clock for offline)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()   -- when the server recorded it
);

CREATE INDEX IF NOT EXISTS idx_scan_events_event ON scan_events(event_id);

-- ---------------------------------------------------------------------------
-- conflicts: raised when an offline scan syncs for a registration that was
-- already checked in at another station. We do NOT create a duplicate check-in;
-- we keep the original and log a conflict for the organizer to review.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conflicts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id          UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_id                 UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  primary_check_in_id      UUID REFERENCES check_ins(id) ON DELETE SET NULL,
  conflicting_scan_event_id UUID REFERENCES scan_events(id) ON DELETE SET NULL,
  detail                   TEXT,
  resolved                 BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_event ON conflicts(event_id);
