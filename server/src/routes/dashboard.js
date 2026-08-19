import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, requireEventOwner } from '../middleware/guards.js';
import { computeEventStats } from '../lib/stats.js';
import { askGemini } from '../lib/gemini.js';

export const dashboardRouter = Router({ mergeParams: true });

const organizerOnly = [requireAuth, requireRole('organizer'), requireEventOwner];

dashboardRouter.get('/:eventId/stats', ...organizerOnly, async (req, res, next) => {
  try {
    res.json(await computeEventStats(req.params.eventId));
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/:eventId/checkins', ...organizerOnly, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.checked_in_at, c.station_id, c.source, u.name AS attendee_name
         FROM check_ins c
         JOIN registrations r ON r.id = c.registration_id
         JOIN users u ON u.id = r.user_id
        WHERE r.event_id = $1
        ORDER BY c.checked_in_at DESC`,
      [req.params.eventId],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/:eventId/conflicts', ...organizerOnly, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT co.id, co.detail, co.created_at, co.resolved, u.name AS attendee_name
         FROM conflicts co
         JOIN registrations r ON r.id = co.registration_id
         JOIN users u ON u.id = r.user_id
        WHERE co.event_id = $1 AND co.resolved = false
        ORDER BY co.created_at DESC`,
      [req.params.eventId],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post('/:eventId/insights', ...organizerOnly, async (req, res, next) => {
  try {
    const question = (req.body?.question ?? '').toString().trim();
    if (!question) return res.status(400).json({ error: 'question_required' });

    const stats = await computeEventStats(req.params.eventId);
    try {
      const answer = await askGemini(question, stats);
      res.json({ answer, fallback: false, stats });
    } catch (aiErr) {
      res.json({ answer: null, fallback: true, stats, fallback_reason: aiErr.message });
    }
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get('/:eventId/export.csv', ...organizerOnly, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.name, u.email, r.created_at AS registered_at,
              (c.id IS NOT NULL) AS checked_in,
              c.checked_in_at, c.station_id, c.source
         FROM registrations r
         JOIN users u ON u.id = r.user_id
    LEFT JOIN check_ins c ON c.registration_id = r.id
        WHERE r.event_id = $1
        ORDER BY u.name ASC`,
      [req.params.eventId],
    );

    const header = ['name', 'email', 'registered_at', 'checked_in', 'checked_in_at', 'station_id', 'source'];
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header.join(',')]
      .concat(rows.map((r) => header.map((h) => esc(r[h])).join(',')))
      .join('\n');

    const safeName = (req.event?.name ?? 'event').replace(/[^a-z0-9]+/gi, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_attendees.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
