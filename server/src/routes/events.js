import { Router } from 'express';
import { query, withTransaction, UNIQUE_VIOLATION } from '../lib/db.js';
import { requireAuth, requireRole, isUuid } from '../middleware/guards.js';
import crypto from 'crypto';

export const eventsRouter = Router();

eventsRouter.post('/', requireAuth, requireRole('organizer'), async (req, res, next) => {
  try {
    const { name, event_date, capacity } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim())
      return res.status(400).json({ error: 'name_required' });
    if (!event_date || Number.isNaN(Date.parse(event_date)))
      return res.status(400).json({ error: 'invalid_event_date' });
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1)
      return res.status(400).json({ error: 'capacity_must_be_positive_int' });

    const { rows } = await query(
      `INSERT INTO events (organizer_id, name, event_date, capacity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, name.trim(), new Date(event_date).toISOString(), cap],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

eventsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const onlyMine = req.user.role === 'organizer';
    const { rows } = await query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM check_ins c
                 JOIN registrations r ON r.id = c.registration_id
                WHERE r.event_id = e.id) AS checked_in_count
         FROM events e
        ${onlyMine ? 'WHERE e.organizer_id = $1' : ''}
        ORDER BY e.event_date ASC`,
      onlyMine ? [req.user.id] : [],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

eventsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'event_not_found' });
    const { rows } = await query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM check_ins c
                 JOIN registrations r ON r.id = c.registration_id
                WHERE r.event_id = e.id) AS checked_in_count
         FROM events e
        WHERE e.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'event_not_found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

eventsRouter.post('/:eventId/register', requireAuth, requireRole('attendee'), async (req, res, next) => {
  const { eventId } = req.params;
  if (!isUuid(eventId)) return res.status(404).json({ error: 'event_not_found' });
  try {
    const result = await withTransaction(async (client) => {
      const upd = await client.query(
        `UPDATE events
            SET registered_count = registered_count + 1
          WHERE id = $1 AND registered_count < capacity
        RETURNING registered_count, capacity`,
        [eventId],
      );

      if (upd.rows.length === 0) {
        const ev = await client.query('SELECT 1 FROM events WHERE id = $1', [eventId]);
        return { status: ev.rows.length ? 409 : 404,
                 body: { error: ev.rows.length ? 'capacity_full' : 'event_not_found' } };
      }

      const qrSecret = crypto.randomBytes(16).toString('hex');
      try {
        const reg = await client.query(
          `INSERT INTO registrations (event_id, user_id, qr_secret)
           VALUES ($1, $2, $3)
           RETURNING id, event_id, user_id, created_at`,
          [eventId, req.user.id, qrSecret],
        );
        return { status: 201, body: reg.rows[0] };
      } catch (err) {
        if (err.code === UNIQUE_VIOLATION) {
          const e = new Error('already_registered');
          e.httpStatus = 409;
          throw e;
        }
        throw err;
      }
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    if (err.message === 'already_registered')
      return res.status(409).json({ error: 'already_registered' });
    next(err);
  }
});
