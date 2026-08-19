# Concurrency Proof — Hard Requirement 1

Output of `npm run proof`, which fires concurrent requests at the live
endpoints and asserts the final counts directly in Postgres.

```
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

## Why this holds across multiple server processes

- **Duplicate check-ins** are prevented by a `UNIQUE` constraint on
  `check_ins.registration_id`. The first `INSERT` wins; every concurrent
  `INSERT` fails with SQLSTATE `23505`, which the API returns as a
  duplicate. A unique constraint is enforced by the database, so it holds
  no matter how many server processes insert at once.
- **Capacity** is enforced by `UPDATE events SET registered_count =
  registered_count + 1 WHERE id = $1 AND registered_count < capacity`
  inside a transaction. Postgres row-locks the event, serialising the
  concurrent registrations; once the count reaches capacity the `WHERE`
  matches no rows and the registration is rejected.
- No in-memory mutex or flag is used anywhere — that would only protect a
  single process, which the brief explicitly rules out.