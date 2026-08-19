// ============================================================================
// CONCURRENCY PROOF — Hard Requirement 1
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATE_PORTS = [4000, 4001];
const A_SCANS = 150;      // concurrent duplicate scans
const B_ATTENDEES = 200;  // concurrent registrations
const B_CAPACITY = 5;     // event capacity for scenario B

let url = process.env.DATABASE_URL;
if (process.env.DB_PASSWORD) {
  url = (url ?? '').replace('[YOUR-PASSWORD]', encodeURIComponent(process.env.DB_PASSWORD));
}
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const db = new pg.Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
});
db.on('error', (err) => console.error('[Proof DB Pool error]', err.message));

const log = [];
function out(line = '') { console.log(line); log.push(line); }

async function findLiveServers() {
  const live = [];
  for (const p of CANDIDATE_PORTS) {
    try {
      const r = await fetch(`http://localhost:${p}/health`);
      if (r.ok) live.push(`http://localhost:${p}`);
    } catch { /* not up */ }
  }
  return live;
}

async function api(base, method, path, body, token) {
  const r = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, json };
}

const uniq = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

async function signup(base, role) {
  const email = `proof_${role}_${uniq()}@test.local`;
  if (role === 'organizer') {
    const { json } = await api(base, 'POST', '/api/auth/provision-organizer', {
      email,
      password: 'password123',
      name: `Proof Organizer`,
      organizer_key: 'checkpoint_org_key_2026',
    });
    return { token: json.token, id: json.user?.id, email };
  } else {
    const { json } = await api(base, 'POST', '/api/auth/signup', {
      email,
      password: 'password123',
      name: `Proof Attendee`,
    });
    return { token: json.token, id: json.user?.id, email };
  }
}

async function main() {
  const servers = await findLiveServers();
  if (servers.length === 0) {
    out('✗ No server reachable on ports 4000/4001. Start the server(s) first.');
    process.exit(1);
  }
  out('='.repeat(70));
  out('CONCURRENCY PROOF — Event Check-In System');
  out(`Run at: ${new Date().toISOString()}`);
  out(`Servers hit (round-robin): ${servers.join(', ')}`);
  out(`Multi-process: ${servers.length >= 2 ? 'YES — two processes, one DB' :
       'NO — only one server up. Start a 2nd (npm run dev:2) for the full proof.'}`);
  out('='.repeat(70));
  const pick = (i) => servers[i % servers.length];

  let pass = true;

  // ---- SCENARIO A: duplicate check-in --------------------------------------
  out('');
  out(`SCENARIO A — ${A_SCANS} concurrent scans of ONE QR token`);
  const organizer = await signup(servers[0], 'organizer');
  const evA = await api(servers[0], 'POST', '/api/events', {
    name: `ProofA ${uniq()}`, event_date: new Date(Date.now() + 86400000).toISOString(), capacity: 10,
  }, organizer.token);
  const eventAId = evA.json.id;

  const attendeeA = await signup(servers[0], 'attendee');
  const regA = await api(servers[0], 'POST', `/api/events/${eventAId}/register`, null, attendeeA.token);
  const regAId = regA.json.id;
  const tok = await api(servers[0], 'GET', `/api/registrations/${regAId}/token`, null, attendeeA.token);
  const token = tok.json.token;

  const scanResults = await Promise.all(
    Array.from({ length: A_SCANS }, (_, i) =>
      api(pick(i), 'POST', '/api/checkins', { token, station_id: `s${i % 2}` }, organizer.token)),
  );
  const aAccepted = scanResults.filter((r) => r.json?.status === 'accepted').length;
  const aDuplicate = scanResults.filter((r) => r.json?.status === 'duplicate').length;

  const { rows: aRows } = await db.query(
    'SELECT COUNT(*)::int AS n FROM check_ins WHERE registration_id = $1', [regAId]);
  const aDbCount = aRows[0].n;

  const aOk = aAccepted === 1 && aDuplicate === A_SCANS - 1 && aDbCount === 1;
  pass = pass && aOk;
  out(`  HTTP:  accepted=${aAccepted}  duplicate=${aDuplicate}  (of ${A_SCANS})`);
  out(`  DB:    check_ins for this registration = ${aDbCount}  (must be exactly 1)`);
  out(`  RESULT: ${aOk ? '✓ PASS — exactly one check-in, all others rejected' : '✗ FAIL'}`);

  // ---- SCENARIO B: capacity ------------------------------------------------
  out('');
  out(`SCENARIO B — ${B_ATTENDEES} concurrent registrations, capacity ${B_CAPACITY}`);
  const evB = await api(servers[0], 'POST', '/api/events', {
    name: `ProofB ${uniq()}`, event_date: new Date(Date.now() + 86400000).toISOString(), capacity: B_CAPACITY,
  }, organizer.token);
  const eventBId = evB.json.id;

  out(`  creating ${B_ATTENDEES} attendee accounts in concurrent batches...`);
  const attendees = [];
  const BATCH_SIZE = 25;
  for (let i = 0; i < B_ATTENDEES; i += BATCH_SIZE) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(BATCH_SIZE, B_ATTENDEES - i) }, (_, j) =>
        signup(pick(i + j), 'attendee'))
    );
    attendees.push(...batch);
  }

  out('  firing 200 registrations simultaneously across both servers...');
  const regResults = await Promise.all(
    attendees.map((a, i) =>
      api(pick(i), 'POST', `/api/events/${eventBId}/register`, null, a.token)),
  );
  const bAccepted = regResults.filter((r) => r.status === 201).length;
  const bFull = regResults.filter((r) => r.json?.error === 'capacity_full').length;

  const { rows: bRows } = await db.query(
    'SELECT registered_count FROM events WHERE id = $1', [eventBId]);
  const { rows: bReg } = await db.query(
    'SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1', [eventBId]);
  const bCounter = bRows[0].registered_count;
  const bRegRows = bReg[0].n;

  const bOk = bAccepted === B_CAPACITY && bFull === B_ATTENDEES - B_CAPACITY &&
              bCounter === B_CAPACITY && bRegRows === B_CAPACITY;
  pass = pass && bOk;
  out(`  HTTP:  accepted=${bAccepted}  capacity_full=${bFull}  (of ${B_ATTENDEES})`);
  out(`  DB:    events.registered_count=${bCounter}  registrations rows=${bRegRows}  (both must be ${B_CAPACITY})`);
  out(`  RESULT: ${bOk ? `✓ PASS — exactly ${B_CAPACITY} registered, never ${B_CAPACITY + 1}` : '✗ FAIL'}`);

  // ---- SCENARIO C: offline sync idempotency & conflict resolution ------------
  out('');
  out(`SCENARIO C — Offline sync idempotency & conflict handling`);
  const attendeeC = await signup(servers[0], 'attendee');
  const regC = await api(servers[0], 'POST', `/api/events/${eventAId}/register`, null, attendeeC.token);
  const regCId = regC.json.id;
  const tokC = await api(servers[0], 'GET', `/api/registrations/${regCId}/token`, null, attendeeC.token);
  const tokenC = tokC.json.token;

  const offlineScanId = `scan_proof_${uniq()}`;
  const offlineScanPayload = {
    scans: [{
      client_scan_id: offlineScanId,
      token: tokenC,
      station_id: 'gate-offline-1',
      scanned_at: new Date().toISOString(),
    }],
  };

  // 1st sync: should accept
  const sync1 = await api(servers[0], 'POST', '/api/checkins/sync', offlineScanPayload, organizer.token);
  const sync1Outcome = sync1.json?.results?.[0]?.outcome;

  // 2nd sync (retry): should be idempotent
  const sync2 = await api(servers[0], 'POST', '/api/checkins/sync', offlineScanPayload, organizer.token);
  const sync2Idempotent = sync2.json?.results?.[0]?.idempotent;

  // 3rd sync from another station: should record conflict
  const conflictScanId = `scan_proof_conflict_${uniq()}`;
  const conflictPayload = {
    scans: [{
      client_scan_id: conflictScanId,
      token: tokenC,
      station_id: 'gate-offline-2',
      scanned_at: new Date().toISOString(),
    }],
  };
  const sync3 = await api(servers[0], 'POST', '/api/checkins/sync', conflictPayload, organizer.token);
  const sync3Outcome = sync3.json?.results?.[0]?.outcome;

  const { rows: cCheckinRows } = await db.query(
    'SELECT COUNT(*)::int AS n FROM check_ins WHERE registration_id = $1', [regCId]);
  const { rows: cConflictRows } = await db.query(
    'SELECT COUNT(*)::int AS n FROM conflicts WHERE registration_id = $1', [regCId]);

  const cOk = sync1Outcome === 'accepted' && sync2Idempotent === true &&
              sync3Outcome === 'conflict_flagged' && cCheckinRows[0].n === 1 && cConflictRows[0].n >= 1;
  pass = pass && cOk;
  out(`  Sync 1: Outcome = ${sync1Outcome}`);
  out(`  Sync 2 (Duplicate Retry): Idempotent = ${sync2Idempotent}`);
  out(`  Sync 3 (Collision from Station 2): Outcome = ${sync3Outcome}`);
  out(`  DB: check_ins = ${cCheckinRows[0].n} (must be 1), conflicts = ${cConflictRows[0].n} (>= 1)`);
  out(`  RESULT: ${cOk ? '✓ PASS — idempotent sync & deterministic conflict resolution' : '✗ FAIL'}`);


  // ---- summary -------------------------------------------------------------
  out('');
  out('='.repeat(70));
  out(`OVERALL: ${pass ? '✓ ALL SCENARIOS PASSED' : '✗ FAILURE — see above'}`);
  out('='.repeat(70));

  const md = [
    '# Concurrency Proof — Hard Requirement 1', '',
    'Output of `npm run proof`, which fires concurrent requests at the live',
    'endpoints and asserts the final counts directly in Postgres.', '',
    '```', ...log, '```', '',
    '## Why this holds across multiple server processes',
    '',
    '- **Duplicate check-ins** are prevented by a `UNIQUE` constraint on',
    '  `check_ins.registration_id`. The first `INSERT` wins; every concurrent',
    '  `INSERT` fails with SQLSTATE `23505`, which the API returns as a',
    '  duplicate. A unique constraint is enforced by the database, so it holds',
    '  no matter how many server processes insert at once.',
    '- **Capacity** is enforced by `UPDATE events SET registered_count =',
    '  registered_count + 1 WHERE id = $1 AND registered_count < capacity`',
    '  inside a transaction. Postgres row-locks the event, serialising the',
    '  concurrent registrations; once the count reaches capacity the `WHERE`',
    '  matches no rows and the registration is rejected.',
    '- No in-memory mutex or flag is used anywhere — that would only protect a',
    '  single process, which the brief explicitly rules out.',
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, '..', '..', 'PROOF.md'), md);
  out('\nWrote PROOF.md');

  await db.end();
  process.exit(pass ? 0 : 1);
}

main().catch(async (err) => {
  out('✗ proof crashed: ' + err.stack);
  try { await db.end(); } catch {}
  process.exit(1);
});
