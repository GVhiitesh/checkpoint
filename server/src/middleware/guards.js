import { verifyJwt } from '../lib/auth.js';
import { query } from '../lib/db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  try {
    const payload = verifyJwt(token);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_or_expired_token' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'forbidden', need: role });
    }
    next();
  };
}

export async function requireEventOwner(req, res, next) {
  const eventId = req.params.eventId ?? req.params.id;
  if (!eventId) return res.status(400).json({ error: 'missing_event_id' });
  if (!isUuid(eventId)) return res.status(404).json({ error: 'event_not_found' });
  try {
    const { rows } = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (rows.length === 0) return res.status(404).json({ error: 'event_not_found' });
    if (rows[0].organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'not_your_event' });
    }
    req.event = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
