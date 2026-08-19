import { query } from './db.js';

export async function computeEventStats(eventId) {
  const { rows: er } = await query('SELECT * FROM events WHERE id = $1', [eventId]);
  const event = er[0];
  if (!event) return null;

  const registered = event.registered_count;
  const capacity = event.capacity;

  const { rows: cr } = await query(
    `SELECT COUNT(*)::int AS checked_in,
            MIN(checked_in_at) AS first_checkin,
            MAX(checked_in_at) AS last_checkin
       FROM check_ins c JOIN registrations r ON r.id = c.registration_id
      WHERE r.event_id = $1`,
    [eventId],
  );
  const checkedIn = cr[0]?.checked_in ?? 0;

  const { rows: peak } = await query(
    `SELECT to_timestamp(floor(extract(epoch from checked_in_at) / 300) * 300) AS bucket,
            COUNT(*)::int AS n
       FROM check_ins c JOIN registrations r ON r.id = c.registration_id
      WHERE r.event_id = $1
      GROUP BY bucket ORDER BY n DESC, bucket ASC LIMIT 1`,
    [eventId],
  );

  const noShow = registered - checkedIn;
  const noShowPct = registered > 0 ? Math.round((noShow / registered) * 1000) / 10 : 0;
  const spotsLeft = capacity - registered;
  const checkedInPct = registered > 0 ? Math.round((checkedIn / registered) * 1000) / 10 : 0;

  return {
    event_id: eventId,
    event_name: event.name,
    capacity,
    registered,
    checked_in: checkedIn,
    checked_in_pct: checkedInPct,
    no_shows: noShow,
    no_show_pct: noShowPct,
    spots_left: spotsLeft,
    first_check_in_at: cr[0]?.first_checkin ?? null,
    last_check_in_at: cr[0]?.last_checkin ?? null,
    peak_window_start: peak[0]?.bucket ?? null,
    peak_window_count: peak[0]?.n ?? 0,
  };
}
