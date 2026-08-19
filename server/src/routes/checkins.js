import { Router } from 'express';
import { pool, UNIQUE_VIOLATION } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/guards.js';
import { verifyToken, currentWindow, deriveShortCode } from '../lib/qr.js';

export const checkinsRouter = Router();

async function attemptCheckIn(client, { registrationId, scannedBy, stationId, source }) {
  try {
    const { rows } = await client.query(
      `INSERT INTO check_ins (registration_id, scanned_by, station_id, source)
       VALUES ($1, $2, $3, $4)
       RETURNING id, checked_in_at`,
      [registrationId, scannedBy ?? null, stationId, source],
    );
    await client.query(
      `UPDATE registrations SET token_consumed_at = now() WHERE id = $1`,
      [registrationId],
    );
    return { outcome: 'accepted', checkInId: rows[0].id, checkedInAt: rows[0].checked_in_at };
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      const existing = await client.query(
        `SELECT checked_in_at, station_id FROM check_ins WHERE registration_id = $1`,
        [registrationId],
      );
      return {
        outcome: 'duplicate',
        checkedInAt: existing.rows[0]?.checked_in_at ?? null,
        existingStation: existing.rows[0]?.station_id ?? null,
      };
    }
    throw err;
  }
}

async function registrationInfo(client, registrationId) {
  const { rows } = await client.query(
    `SELECT r.id, r.event_id, e.organizer_id, u.name AS attendee_name
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       JOIN users u ON u.id = r.user_id
      WHERE r.id = $1`,
    [registrationId],
  );
  return rows[0] ?? null;
}

function fmtTime(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

checkinsRouter.post('/', requireAuth, requireRole('organizer'), async (req, res, next) => {
  const { token, station_id = 'default' } = req.body ?? {};
  const io = req.app.get('io');
  const client = await pool.connect();
  try {
    let registrationId = null;
    const cleanToken = (token || '').trim();

    if (cleanToken.includes('.')) {
      const v = verifyToken(cleanToken);
      if (!v.ok) {
        await client.query(
          `INSERT INTO scan_events (registration_id, event_id, outcome, station_id)
           VALUES (NULL, NULL, $1, $2)`,
          [v.reason, station_id],
        );
        return res.status(400).json({ status: v.reason, message: 'Invalid or expired code' });
      }
      registrationId = v.registrationId;
    } else if (cleanToken.length === 5) {
      // 5-letter rotating passcode verification (works just like QR code)
      const expectedWindow = currentWindow();
      const codeUpper = cleanToken.toUpperCase();

      const regList = await client.query(
        `SELECT r.id, r.event_id, e.organizer_id
           FROM registrations r
           JOIN events e ON e.id = r.event_id
          WHERE e.organizer_id = $1`,
        [req.user.id],
      );

      let match = null;
      for (const r of regList.rows) {
        const curCode = deriveShortCode(r.id, expectedWindow);
        const prevCode = deriveShortCode(r.id, expectedWindow - 1);
        if (curCode === codeUpper || prevCode === codeUpper) {
          match = r;
          break;
        }
      }

      if (!match) {
        await client.query(
          `INSERT INTO scan_events (registration_id, event_id, outcome, station_id)
           VALUES (NULL, NULL, 'invalid_token', $1)`,
          [station_id],
        );
        return res.status(400).json({ status: 'invalid_token', message: 'Invalid or expired 5-letter pass token' });
      }
      registrationId = match.id;
    } else {
      return res.status(400).json({ status: 'invalid_token', message: 'Invalid token or passcode' });
    }

    const info = await registrationInfo(client, registrationId);
    if (!info) return res.status(404).json({ status: 'invalid_token', message: 'Unknown registration' });
    if (info.organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'not_your_event', message: 'You are not the organizer of this event' });
    }

    const result = await attemptCheckIn(client, {
      registrationId,
      scannedBy: req.user.id,
      stationId: station_id,
      source: 'online',
    });

    await client.query(
      `INSERT INTO scan_events (registration_id, event_id, outcome, station_id)
       VALUES ($1, $2, $3, $4)`,
      [registrationId, info.event_id, result.outcome, station_id],
    );

    if (result.outcome === 'accepted') {
      io?.to(`event:${info.event_id}`).emit('checkin:new', {
        registration_id: info.id,
        attendee_name: info.attendee_name,
        checked_in_at: result.checkedInAt,
        station_id,
      });
      return res.json({
        status: 'accepted',
        attendee_name: info.attendee_name,
        checked_in_at: result.checkedInAt,
        message: `${info.attendee_name} checked in`,
      });
    }

    return res.status(409).json({
      status: 'duplicate',
      attendee_name: info.attendee_name,
      checked_in_at: result.checkedInAt,
      message: `Already checked in at ${fmtTime(result.checkedInAt)}`,
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

checkinsRouter.post('/sync', requireAuth, requireRole('organizer'), async (req, res, next) => {
  const scans = Array.isArray(req.body?.scans) ? req.body.scans : null;
  if (!scans) return res.status(400).json({ error: 'scans_array_required' });
  const io = req.app.get('io');
  const results = [];

  for (const scan of scans) {
    const { token, client_scan_id, station_id = 'default' } = scan ?? {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (client_scan_id) {
        const seen = await client.query(
          `SELECT outcome FROM scan_events WHERE client_scan_id = $1`,
          [client_scan_id],
        );
        if (seen.rows.length) {
          await client.query('COMMIT');
          results.push({ client_scan_id, outcome: seen.rows[0].outcome, idempotent: true });
          continue;
        }
      }

      const v = verifyToken(token, { referenceTime: scan.scanned_at, isOffline: true });
      if (!v.ok) {
        await client.query(
          `INSERT INTO scan_events (registration_id, event_id, outcome, station_id, client_scan_id, scanned_at)
           VALUES (NULL, NULL, $1, $2, $3, $4)`,
          [v.reason, station_id, client_scan_id ?? null, scan.scanned_at ?? new Date().toISOString()],
        );
        await client.query('COMMIT');
        results.push({ client_scan_id, outcome: v.reason });
        continue;
      }

      const info = await registrationInfo(client, v.registrationId);
      const eventId = info?.event_id ?? null;

      if (info && info.organizer_id !== req.user.id) {
        await client.query(
          `INSERT INTO scan_events (registration_id, event_id, outcome, station_id, client_scan_id, scanned_at)
           VALUES ($1, $2, 'forbidden', $3, $4, $5)`,
          [v.registrationId, eventId, station_id, client_scan_id ?? null, scan.scanned_at ?? new Date().toISOString()],
        );
        await client.query('COMMIT');
        results.push({ client_scan_id, outcome: 'forbidden', error: 'not_your_event' });
        continue;
      }

      const existing = await client.query(
        `SELECT id, station_id, checked_in_at FROM check_ins WHERE registration_id = $1`,
        [v.registrationId],
      );

      if (existing.rows.length === 0) {
        const result = await attemptCheckIn(client, {
          registrationId: v.registrationId,
          scannedBy: req.user.id,
          stationId: station_id,
          source: 'offline_sync',
        });
        await client.query(
          `INSERT INTO scan_events (registration_id, event_id, outcome, station_id, client_scan_id, scanned_at)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [v.registrationId, eventId, result.outcome, station_id, client_scan_id ?? null,
           scan.scanned_at ?? new Date().toISOString()],
        );

        if (result.outcome === 'accepted') {
          io?.to(`event:${eventId}`).emit('checkin:new', {
            registration_id: v.registrationId,
            attendee_name: info?.attendee_name,
            checked_in_at: result.checkedInAt,
            station_id,
            source: 'offline_sync',
          });
        }
        await client.query('COMMIT');
        results.push({ client_scan_id, outcome: result.outcome });
        continue;
      }

      const scanEvt = await client.query(
        `INSERT INTO scan_events (registration_id, event_id, outcome, station_id, client_scan_id, scanned_at)
         VALUES ($1, $2, 'conflict_flagged', $3, $4, $5) RETURNING id`,
        [v.registrationId, eventId, station_id, client_scan_id ?? null,
         scan.scanned_at ?? new Date().toISOString()],
      );
      await client.query(
        `INSERT INTO conflicts (registration_id, event_id, primary_check_in_id, conflicting_scan_event_id, detail)
         VALUES ($1, $2, $3, $4, $5)`,
        [v.registrationId, eventId, existing.rows[0].id, scanEvt.rows[0].id,
         `Offline scan at station "${station_id}" for a registration already checked in at station "${existing.rows[0].station_id}".`],
      );
      io?.to(`event:${eventId}`).emit('conflict:new', {
        registration_id: v.registrationId,
        attendee_name: info?.attendee_name,
        station_id,
        existing_station: existing.rows[0].station_id,
      });
      await client.query('COMMIT');
      results.push({ client_scan_id, outcome: 'conflict_flagged' });
    } catch (err) {
      await client.query('ROLLBACK');
      results.push({ client_scan_id: scan?.client_scan_id, outcome: 'error', error: err.message });
    } finally {
      client.release();
    }
  }

  res.json({ results });
});

