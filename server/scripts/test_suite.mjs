// ============================================================================
// CHECKPOINT — Comprehensive Automated Integration & Security Test Suite
// ============================================================================
import pg from 'pg';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { config } from '../src/lib/config.js';
import { authRouter } from '../src/routes/auth.js';
import { eventsRouter } from '../src/routes/events.js';
import { registrationsRouter } from '../src/routes/registrations.js';
import { checkinsRouter } from '../src/routes/checkins.js';
import { dashboardRouter } from '../src/routes/dashboard.js';
import { issueToken, verifyToken } from '../src/lib/qr.js';

let url = config.databaseUrl;
const pool = new pg.Pool({
  connectionString: url,
  ssl: (url ?? '').includes('localhost') ? false : { rejectUnauthorized: false },
});

// Setup ephemeral test server
const app = express();
app.use(express.json());
app.use(cors());
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/events', dashboardRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/checkins', checkinsRouter);
app.use((err, req, res, next) => {
  res.status(err.httpStatus || 500).json({ error: err.message || 'internal_error' });
});

let server;
let baseUrl = '';

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
}

async function api(method, path, body, token) {
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json, ok: r.ok };
}

const uniq = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, name, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ? [PASS] ${name}`);
  } else {
    failedTests++;
    console.error(`  ? [FAIL] ${name} ${details ? `— ${details}` : ''}`);
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('CHECKPOINT — Automated Test Suite (Security, Concurrency & Invariants)');
  console.log('='.repeat(70));

  await startServer();

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Authentication & Role Escalation
  // --------------------------------------------------------------------------
  console.log('\n[1] Authentication & Privilege Escalation Tests');

  const privEsc = await api('POST', '/api/auth/signup', {
    email: `attacker_${uniq()}@test.local`,
    password: 'password123',
    name: 'Privilege Attacker',
    role: 'organizer',
  });
  assert(privEsc.status === 403, 'Public signup with role=organizer is rejected with 403');

  const publicSignup = await api('POST', '/api/auth/signup', {
    email: `attendee_${uniq()}@test.local`,
    password: 'password123',
    name: 'Legit Attendee',
  });
  assert(publicSignup.status === 201 && publicSignup.json?.user?.role === 'attendee', 'Public signup creates attendee role by default');

  const invalidKeyProv = await api('POST', '/api/auth/provision-organizer', {
    email: `badorg_${uniq()}@test.local`,
    password: 'password123',
    name: 'Bad Key Org',
    organizer_key: 'wrong_secret_key',
  });
  assert(invalidKeyProv.status === 403, 'Organizer provisioning with invalid key is rejected with 403');

  const validKeyProv = await api('POST', '/api/auth/provision-organizer', {
    email: `orgA_${uniq()}@test.local`,
    password: 'password123',
    name: 'Legit Organizer A',
    organizer_key: config.organizerProvisionKey,
  });
  assert(validKeyProv.status === 201 && validKeyProv.json?.user?.role === 'organizer', 'Organizer provisioning with valid key succeeds with 201');
  const orgAToken = validKeyProv.json?.token;
  const orgAId = validKeyProv.json?.user?.id;

  const validKeyProvB = await api('POST', '/api/auth/provision-organizer', {
    email: `orgB_${uniq()}@test.local`,
    password: 'password123',
    name: 'Legit Organizer B',
    organizer_key: config.organizerProvisionKey,
  });
  const orgBToken = validKeyProvB.json?.token;
  const orgBId = validKeyProvB.json?.user?.id;

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Authorization & IDOR Protection
  // --------------------------------------------------------------------------
  console.log('\n[2] Authorization & IDOR Isolation Tests');

  const attendeeToken = publicSignup.json?.token;
  const attendeeId = publicSignup.json?.user?.id;

  const attendeeCreateEvent = await api('POST', '/api/events', {
    name: 'Unauthorized Event',
    event_date: new Date(Date.now() + 86400000).toISOString(),
    capacity: 50,
  }, attendeeToken);
  assert(attendeeCreateEvent.status === 403, 'Attendee cannot create events (403 Forbidden)');

  const orgACreateEvent = await api('POST', '/api/events', {
    name: `OrgA Event ${uniq()}`,
    event_date: new Date(Date.now() + 86400000).toISOString(),
    capacity: 10,
  }, orgAToken);
  assert(orgACreateEvent.status === 201, 'Organizer A creates event (201 Created)');
  const eventAId = orgACreateEvent.json?.id;

  const orgBStatsOnA = await api('GET', `/api/events/${eventAId}/stats`, null, orgBToken);
  assert(orgBStatsOnA.status === 403, 'Organizer B cannot access Organizer A event stats (403 Forbidden)');

  const attendeeStatsOnA = await api('GET', `/api/events/${eventAId}/stats`, null, attendeeToken);
  assert(attendeeStatsOnA.status === 403, 'Attendee cannot access event organizer stats (403 Forbidden)');

  const invalidUuidStats = await api('GET', '/api/events/not-a-valid-uuid/stats', null, orgAToken);
  assert(invalidUuidStats.status === 404, 'Invalid UUID in route parameter handled safely (404 Not Found)');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Registration & Duplicate Prevention
  // --------------------------------------------------------------------------
  console.log('\n[3] Registration & Duplicate Prevention Tests');

  const reg1 = await api('POST', `/api/events/${eventAId}/register`, null, attendeeToken);
  assert(reg1.status === 201, 'Attendee successfully registers for event (201 Created)');
  const reg1Id = reg1.json?.id;

  const regDup = await api('POST', `/api/events/${eventAId}/register`, null, attendeeToken);
  assert(regDup.status === 409 && regDup.json?.error === 'already_registered', 'Duplicate registration rejected with 409 already_registered');

  const otherAttendee = await api('POST', '/api/auth/signup', {
    email: `attendee_other_${uniq()}@test.local`,
    password: 'password123',
    name: 'Other Attendee',
  });
  const otherAttendeeToken = otherAttendee.json?.token;

  const idorTicket = await api('GET', `/api/registrations/${reg1Id}/token`, null, otherAttendeeToken);
  assert(idorTicket.status === 403, 'Attendee B cannot steal Attendee A ticket token (403 Forbidden)');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: QR Cryptographic Security & Anti-Replay
  // --------------------------------------------------------------------------
  console.log('\n[4] QR Cryptography & Expiration Tests');

  const validTokenRes = await api('GET', `/api/registrations/${reg1Id}/token`, null, attendeeToken);
  const qrToken = validTokenRes.json?.token;
  assert(typeof qrToken === 'string' && qrToken.split('.').length === 3, 'Token generated in format registrationId.window.signature');

  const verifyValid = verifyToken(qrToken);
  assert(verifyValid.ok === true && verifyValid.registrationId === reg1Id, 'Valid QR token verifies successfully');

  const tamperedToken = `${qrToken.slice(0, -4)}abcd`;
  const verifyTampered = verifyToken(tamperedToken);
  assert(verifyTampered.ok === false && verifyTampered.reason === 'invalid_token', 'Tampered QR signature is rejected (invalid_token)');

  const oldWindowToken = `${reg1Id}.${Math.floor(Date.now() / 30000) - 5}.1234567890abcdef1234567890abcdef`;
  const verifyOld = verifyToken(oldWindowToken);
  assert(verifyOld.ok === false, 'Expired QR time window is rejected');

  const futureScanToken = verifyToken(qrToken, { referenceTime: Date.now() + 1000000 });
  assert(futureScanToken.ok === false && futureScanToken.reason === 'invalid_token', 'Future timestamp scan is rejected (invalid_token)');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Cross-Organizer Scan Isolation (IDOR)
  // --------------------------------------------------------------------------
  console.log('\n[5] Cross-Organizer Scan Isolation');

  const orgBScanOrgA = await api('POST', '/api/checkins', {
    token: qrToken,
    station_id: 'gate-rogue',
  }, orgBToken);
  assert(orgBScanOrgA.status === 403, 'Organizer B cannot check in attendee for Organizer A event (403 Forbidden)');

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Check-In & Race Condition Prevention
  // --------------------------------------------------------------------------
  console.log('\n[6] Concurrency Check-In Race Condition Tests');

  const CONCURRENT_SCANS = 30;
  const scanPromises = Array.from({ length: CONCURRENT_SCANS }, (_, i) =>
    api('POST', '/api/checkins', { token: qrToken, station_id: `station-${i % 3}` }, orgAToken)
  );
  const scanResults = await Promise.all(scanPromises);
  const acceptedScans = scanResults.filter(r => r.json?.status === 'accepted').length;
  const duplicateScans = scanResults.filter(r => r.json?.status === 'duplicate').length;

  const { rows: checkinDbRows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM check_ins WHERE registration_id = $1',
    [reg1Id]
  );
  assert(acceptedScans === 1 && duplicateScans === CONCURRENT_SCANS - 1 && checkinDbRows[0].n === 1,
    `30 concurrent scans -> exactly 1 accepted, 29 duplicate, DB check_ins count = 1 (actual: ${checkinDbRows[0].n})`);

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Event Capacity Concurrency Invariant
  // --------------------------------------------------------------------------
  console.log('\n[7] Event Capacity Concurrency Stress Test');

  const CAP_LIMIT = 4;
  const ATTEMPTS = 25;
  const capEvent = await api('POST', '/api/events', {
    name: `Cap Stress Event ${uniq()}`,
    event_date: new Date(Date.now() + 86400000).toISOString(),
    capacity: CAP_LIMIT,
  }, orgAToken);
  const capEventId = capEvent.json?.id;

  const attendeeBatch = [];
  for (let i = 0; i < ATTEMPTS; i++) {
    const att = await api('POST', '/api/auth/signup', {
      email: `cap_att_${i}_${uniq()}@test.local`,
      password: 'password123',
      name: `Cap Attendee ${i}`,
    });
    attendeeBatch.push(att.json?.token);
  }

  const regStressResults = await Promise.all(
    attendeeBatch.map(token => api('POST', `/api/events/${capEventId}/register`, null, token))
  );
  const successRegs = regStressResults.filter(r => r.status === 201).length;
  const fullRegs = regStressResults.filter(r => r.json?.error === 'capacity_full').length;

  const { rows: evRows } = await pool.query(
    'SELECT registered_count, capacity FROM events WHERE id = $1',
    [capEventId]
  );
  const { rows: regCountRows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1',
    [capEventId]
  );

  assert(
    successRegs === CAP_LIMIT &&
    fullRegs === ATTEMPTS - CAP_LIMIT &&
    evRows[0].registered_count === CAP_LIMIT &&
    regCountRows[0].n === CAP_LIMIT,
    `Event capacity ${CAP_LIMIT} with ${ATTEMPTS} concurrent registrations -> exactly ${CAP_LIMIT} admitted, ${ATTEMPTS - CAP_LIMIT} rejected. DB registered_count = ${evRows[0].registered_count}`
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 8: Offline Sync Idempotency & Conflict Resolution
  // --------------------------------------------------------------------------
  console.log('\n[8] Offline Sync & Conflict Resolution Tests');

  const offlineAttendee = await api('POST', '/api/auth/signup', {
    email: `offline_att_${uniq()}@test.local`,
    password: 'password123',
    name: 'Offline Attendee',
  });
  const offReg = await api('POST', `/api/events/${eventAId}/register`, null, offlineAttendee.json?.token);
  const offRegId = offReg.json?.id;
  const offTok = await api('GET', `/api/registrations/${offRegId}/token`, null, offlineAttendee.json?.token);
  const offToken = offTok.json?.token;

  const clientScanId = `scan_offline_test_${uniq()}`;
  const sync1 = await api('POST', '/api/checkins/sync', {
    scans: [{
      client_scan_id: clientScanId,
      token: offToken,
      station_id: 'gate-west',
      scanned_at: new Date().toISOString(),
    }],
  }, orgAToken);
  assert(sync1.json?.results?.[0]?.outcome === 'accepted', 'Offline batch sync accepted (outcome=accepted)');

  const sync2Retry = await api('POST', '/api/checkins/sync', {
    scans: [{
      client_scan_id: clientScanId,
      token: offToken,
      station_id: 'gate-west',
      scanned_at: new Date().toISOString(),
    }],
  }, orgAToken);
  assert(sync2Retry.json?.results?.[0]?.idempotent === true, 'Duplicate offline sync with same client_scan_id is idempotent');

  const conflictScanId = `scan_offline_conflict_${uniq()}`;
  const sync3Conflict = await api('POST', '/api/checkins/sync', {
    scans: [{
      client_scan_id: conflictScanId,
      token: offToken,
      station_id: 'gate-east',
      scanned_at: new Date().toISOString(),
    }],
  }, orgAToken);
  assert(sync3Conflict.json?.results?.[0]?.outcome === 'conflict_flagged', 'Simultaneous station collision flagged as conflict_flagged');

  const { rows: conflictRows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM conflicts WHERE registration_id = $1',
    [offRegId]
  );
  assert(conflictRows[0].n >= 1, `Conflict logged in conflicts table (rows: ${conflictRows[0].n})`);

  // --------------------------------------------------------------------------
  // TEST GROUP 9: AI Grounded Insights & Fallback Resilience
  // --------------------------------------------------------------------------
  console.log('\n[9] AI Copilot & Graceful Fallback Tests');

  const aiInsightsRes = await api('POST', `/api/events/${eventAId}/insights`, {
    question: 'How many attendees are currently checked in?',
  }, orgAToken);

  assert(aiInsightsRes.status === 200, 'AI insights endpoint responds with 200 OK');
  assert(aiInsightsRes.json?.stats?.event_id === eventAId, 'Verified database statistics included in AI payload');
  assert(typeof aiInsightsRes.json?.fallback === 'boolean', 'Fallback flag present and boolean');

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('='.repeat(70));

  server.close();
  await pool.end();

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('? ALL TEST SUITES PASSED CLEANLY\n');
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Test runner fatal error:', err);
  try { server?.close(); } catch {}
  try { await pool.end(); } catch {}
  process.exit(1);
});
