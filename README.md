# CHECKPOINT — Concurrency-Safe Event Check-In System

> **Production-grade, database-enforced event registration and door check-in platform designed for high-concurrency environments, multi-server horizontal scaling, and offline-first door scanning.**

---

## 📌 Architecture & Design Philosophy

In real-world event check-in systems, hundreds of attendees often scan tickets or register simultaneously across multiple stations and server instances. Standard application-level locks (such as in-memory mutexes, Node.js process variables, or frontend validations) fail immediately when running multiple server replicas.

**CHECKPOINT** enforces all core invariants at the **PostgreSQL database layer using atomic relational constraints and transactions**. The application servers remain completely stateless.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT (React + Vite)                             |
|  - Organizer Dashboard (Real-time Live Stats, Conflict Alerts, AI Insights)       |
|  - Attendee Portal (View Tickets, Dynamic 30s HMAC QR Code with countdown)        |
|  - Station Scanner (Camera QR reader, Offline IndexedDB Queue, Auto-Sync)         |
+--------------------------+------------------------------+-------------------------+
                           |                              |
            HTTP REST / Sync API (JWT)            Socket.io Realtime (Rooms)
                           |                              |
+--------------------------v------------------------------v-------------------------+
|                              SERVER (Node.js + Express + TS)                      |
|  - Auth Middleware (JWT Bearer, Roles: Organizer/Attendee, Event Owner Guard)     |
|  - Concurrency-Safe Registration Engine (Atomic Conditional UPDATE Transaction)   |
|  - QR Security Token Verifier (HMAC-SHA256, 30s window, Replay Prevention)        |
|  - Offline Sync & Conflict Detection Engine (Client Scan Idempotency)             |
|  - Gemini AI Insight Generator (Backend-grounded statistics + graceful fallback)  |
+------------------------------------------+----------------------------------------+
                                           |
                                   Raw pg Pool / SQL
                                           |
+------------------------------------------v----------------------------------------+
|                               PostgreSQL (Supabase)                               |
|  - users (organizer / attendee)                                                   |
|  - events (id, capacity, registered_count)                                        |
|  - registrations (UNIQUE(event_id, user_id), qr_secret, token_consumed_at)        |
|  - check_ins (UNIQUE(registration_id) -> Hard duplicate check-in prevention)      |
|  - scan_events (UNIQUE(client_scan_id) -> Hard sync idempotency)                  |
|  - conflicts (station sync collision audit trail)                                 |
+-----------------------------------------------------------------------------------+
```

---

## ⚡ Concurrency & Invariant Enforcement

### 1. Zero Overcapacity Registrations (Scenario B)
When 200 attendees register simultaneously for an event with a capacity of 5, standard systems suffer from the classic **Read-Modify-Write Race Condition** (all requests read `count = 4` and simultaneously increment).

**CHECKPOINT Solution:**
Registration executes inside an atomic transaction utilizing a conditional `UPDATE` with PostgreSQL row locking:
```sql
BEGIN;
UPDATE events
   SET registered_count = registered_count + 1
 WHERE id = $1 AND registered_count < capacity
RETURNING registered_count, capacity;
-- If 0 rows returned: ROLLBACK & return 409 (capacity_full)
-- If slot claimed: INSERT INTO registrations (event_id, user_id, qr_secret)
-- If already registered: UNIQUE(event_id, user_id) raises SQLSTATE 23505 -> ROLLBACK & return 409
COMMIT;
```
PostgreSQL takes an exclusive row-lock on the event row during the transaction. Competing server processes queue sequentially behind the lock. Once `registered_count` reaches `capacity`, the `WHERE` clause matches 0 rows, triggering an immediate rollback.

### 2. Absolute Single Check-In Guarantee (Scenario A)
When 150 concurrent scans hit the API for the same ticket across multiple servers, no duplicate check-in row can physically be written.

**CHECKPOINT Solution:**
```sql
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scanned_by UUID REFERENCES users(id),
    station_id TEXT NOT NULL DEFAULT 'default',
    source TEXT NOT NULL CHECK (source IN ('online', 'offline_sync'))
);
```
The database-level `UNIQUE (registration_id)` constraint guarantees that only the first `INSERT` succeeds. The other 149 requests fail with PostgreSQL SQLSTATE `23505` (`UNIQUE_VIOLATION`), returning HTTP `409` with a clear explanation (`Already checked in at HH:MM`).

---

## 🔒 Cryptographic Rotating QR Protocol

To prevent ticket screenshot abuse:
1. **Dynamic Time-Windowed HMAC:** The backend signs the payload `(registration_id + time_window)` with HMAC-SHA256 using a private `QR_HMAC_SECRET`.
2. **30-Second Rotation:** The client refreshes the token every 25–30 seconds. A screenshot shared with another person expires within seconds.
3. **One-Time Consumption:** Upon the first successful check-in, `registrations.token_consumed_at` is set, invalidating all subsequent token generation and redemption attempts.
4. **Clock-Skew Tolerance:** The backend validator accepts windows `T` (current) and `T-1` (previous) to seamlessly tolerate mobile network latency without compromising security.

---

## 📡 Offline-First Scanner & Conflict Engine

1. **IndexedDB Local Queue:** If a door station loses internet connectivity (`navigator.onLine === false` or network timeout), scans are persisted locally in IndexedDB with a unique `client_scan_id`.
2. **Idempotent Batch Flush (`POST /api/checkins/sync`):** When connectivity is restored, the queue is posted in a batch. The `UNIQUE (client_scan_id)` constraint on `scan_events` prevents double-application if the connection flakily retries.
3. **Conflict Detection (Station A vs Station B):**
   - *Scenario:* Station A scans offline. Station B scans the same attendee online (success). Station A reconnects and flushes.
   - *Resolution:* No duplicate check-in is created. The offline scan is marked as `conflict_flagged`, a record is inserted into `conflicts`, and a `conflict:new` event is broadcast in real-time to the Organizer Dashboard for manual verification.

---

## 🤖 AI Event Insights (Gemini Grounded Architecture)

- **Strict Server-Side Grounding:** The Gemini AI API key resides exclusively on the backend. Gemini is **never** permitted to query the database or calculate metrics.
- **SQL Pre-Computation:** The Node.js server executes direct SQL queries to compute verified statistics:
  - `registered`, `checked_in`, `checked_in_pct`, `no_shows`, `no_show_pct`, `spots_left`, `peak_window_start`, `peak_window_count`.
- **Natural Language Translation:** The verified JSON data block is passed into Gemini's prompt with strict instructions: *"Answer the organizer's question using ONLY the numbers in the DATA block below. Do not invent, estimate, or recompute any number."*
- **Resilient Fallback:** If the Gemini API is unreachable, times out (8s), or is unconfigured, the endpoint gracefully returns raw structured SQL telemetry (`fallback: true`) without crashing or blanking the UI.

---

## 🧪 Verification, Automated Tests & Concurrency Proof

The repository includes both a comprehensive automated test suite (`server/scripts/test_suite.mjs`) and a multi-process stress test proof suite (`server/scripts/proof.mjs`).

### 1. Running the Automated Test Suite (27/27 Passing)
```bash
cd server
npm test
```
**Test Coverage Includes:**
- Public Signup Role Escalation Prevention (rejects `role=organizer` with HTTP 403)
- Secure Server-Side Organizer Provisioning
- Cross-Organizer & Attendee Authorization / IDOR Protection
- Malformed UUID Route Parameter Validation
- Atomic PostgreSQL Registration Duplicate Protection (`UNIQUE(event_id, user_id)`)
- Dynamic Cryptographic QR HMAC-SHA256 Minting & Expiration Verification
- Tampered / Future-Timestamped QR Token Rejection
- 30-Request Concurrent Check-In Race Condition Test (Database-level `UNIQUE(registration_id)`)
- 25-Request Concurrent Registration Capacity Cap Invariant Stress Test
- Offline IndexedDB Idempotent Batch Sync (`UNIQUE(client_scan_id)`)
- Real-Time Dual-Station Collision & Conflict Resolution Logging
- Grounded Gemini AI Insights & Graceful Telemetry Fallback on API Timeout/Key Absence

---

### 2. Multi-Process Concurrency Proof (`PROOF.md`)

The concurrency proof fires simultaneous requests at **two independent server instances on ports `4000` and `4001`** connected to the exact same PostgreSQL database.

#### Executing the Multi-Process Proof:
```bash
# Terminal 1: Start Server Process 1
cd server
npm start

# Terminal 2: Start Server Process 2
cd server
npm run dev:2

# Terminal 3: Execute Concurrency Proof
cd server
npm run proof
```

#### Live Output (`PROOF.md`):
```text
======================================================================
CONCURRENCY PROOF — Event Check-In System
Run at: 2026-08-19T18:14:26.942Z
Servers hit (round-robin): http://localhost:4000, http://localhost:4001
Multi-process: YES — two processes, one DB
======================================================================

SCENARIO A — 150 concurrent scans of ONE QR token
  HTTP:  accepted=1  duplicate=149  (of 150)
  DB:    check_ins for this registration = 1  (must be exactly 1)
  RESULT: ✓ PASS — exactly one check-in, all others rejected

SCENARIO B — 200 concurrent registrations, capacity 5
  creating 200 attendee accounts in concurrent batches...
  firing 200 registrations simultaneously across both servers...
  HTTP:  accepted=5  capacity_full=195  (of 200)
  DB:    events.registered_count=5  registrations rows=5  (both must be 5)
  RESULT: ✓ PASS — exactly 5 registered, never 6

SCENARIO C — Offline sync idempotency & conflict handling
  Sync 1: Outcome = accepted
  Sync 2 (Duplicate Retry): Idempotent = true
  Sync 3 (Collision from Station 2): Outcome = conflict_flagged
  DB: check_ins = 1 (must be 1), conflicts = 1 (>= 1)
  RESULT: ✓ PASS — idempotent sync & deterministic conflict resolution

======================================================================
OVERALL: ✓ ALL SCENARIOS PASSED
======================================================================
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ (tested on v25.1.0)
- PostgreSQL (or Supabase connection string)

### 1. Database Setup & Seeding
Configure `server/.env` (see `.env.example`):
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
DB_PASSWORD=your_database_password
JWT_SECRET=your_jwt_signing_secret_here
QR_HMAC_SECRET=your_qr_hmac_signing_secret_here
ORGANIZER_PROVISION_KEY=checkpoint_org_key_2026
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_ORIGIN=*
PORT=4000
```
Run schema migrations and seed demo data:
```bash
cd server
npm run migrate
npm run seed
```

### 2. Start the Backend
```bash
cd server
npm start
```

### 3. Start the Frontend
```bash
cd client
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 📁 Repository Structure

```text
checkpoint/
├── client/                     # Vite + React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/         # QRGenerator, Scanner, StatsGrid, LiveFeed, AIInsightsModal
│   │   ├── context/            # AuthContext (JWT session & Socket connection)
│   │   ├── pages/              # LoginPage, EventsListPage, MyTicketsPage, Dashboard, Scanner
│   │   ├── services/           # api.ts, socket.ts, offlineQueue.ts (IndexedDB)
│   │   └── types/              # TypeScript interface definitions
│   └── package.json
├── server/                     # Node.js + Express + Socket.io + pg
│   ├── db/
│   │   └── schema.sql          # PostgreSQL DDL migrations & constraints
│   ├── scripts/
│   │   ├── migrate.mjs         # Schema migration runner
│   │   ├── seed_demo.mjs       # Demo data seeder
│   │   ├── test_suite.mjs      # Comprehensive automated integration & security test runner
│   │   └── proof.mjs           # Multi-process dual-port concurrency stress proof
│   ├── src/
│   │   ├── lib/                # db, auth, qr, stats, gemini, socket, config
│   │   ├── middleware/         # requireAuth, requireRole, requireEventOwner, isUuid
│   │   ├── routes/             # auth, events, registrations, checkins, dashboard
│   │   └── index.js            # Express & Socket.io server entry point
│   └── package.json
├── PROOF.md                    # Live output of the multi-process concurrency proof
├── README.md                   # System documentation and architecture breakdown
└── .env.example                # Example configuration template
```
