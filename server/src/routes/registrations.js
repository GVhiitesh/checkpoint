import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, isUuid } from '../middleware/guards.js';
import { issueToken, currentWindow, deriveShortCode } from '../lib/qr.js';

export const registrationsRouter = Router();

registrationsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.event_id, r.created_at,
              e.name AS event_name, e.event_date,
              c.checked_in_at
         FROM registrations r
         JOIN events e ON e.id = r.event_id
    LEFT JOIN check_ins c ON c.registration_id = r.id
        WHERE r.user_id = $1
        ORDER BY e.event_date ASC`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

registrationsRouter.get('/:id/token', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'registration_not_found' });
    const { rows } = await query(
      `SELECT r.id, r.user_id, r.token_consumed_at, c.checked_in_at
         FROM registrations r
    LEFT JOIN check_ins c ON c.registration_id = r.id
        WHERE r.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'registration_not_found' });
    if (rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'not_your_registration' });

    if (rows[0].checked_in_at) {
      return res.json({ checked_in: true, checked_in_at: rows[0].checked_in_at });
    }

    const token = issueToken(req.params.id);
    const w = currentWindow();
    const short_code = deriveShortCode(req.params.id, w);
    res.json({ checked_in: false, token, short_code, refresh_in_ms: 25_000 });
  } catch (err) {
    next(err);
  }
});
