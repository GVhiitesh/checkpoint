import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import 'dotenv/config';

let url = process.env.DATABASE_URL;
if (process.env.DB_PASSWORD) {
  url = (url ?? '').replace('[YOUR-PASSWORD]', encodeURIComponent(process.env.DB_PASSWORD));
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: (url ?? '').includes('localhost') ? false : { rejectUnauthorized: false },
});

async function seed() {
  console.log('Seeding Demo Data for CHECKPOINT...');

  const passHashDefault = await bcrypt.hash('password123', 10);
  const passHashAdmin = await bcrypt.hash('Admin123!', 10);
  const passHashPass = await bcrypt.hash('Pass123!', 10);

  // 1. Organizers
  const orgRes = await pool.query(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES ('organizer@checkpoint.io', $1, 'Alex Carter (Lead Organizer)', 'organizer')
    ON CONFLICT (email) DO UPDATE SET password_hash = $1
    RETURNING id;
  `, [passHashDefault]);
  const organizerId = orgRes.rows[0].id;

  await pool.query(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES ('organizer@checkpoint.internal', $1, 'Alex Carter (Lead Organizer)', 'organizer')
    ON CONFLICT (email) DO UPDATE SET password_hash = $1;
  `, [passHashAdmin]);

  // 2. Attendees
  const attRes = await pool.query(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES ('attendee@checkpoint.io', $1, 'Jane Doe (Attendee)', 'attendee')
    ON CONFLICT (email) DO UPDATE SET password_hash = $1
    RETURNING id;
  `, [passHashDefault]);
  const attendeeId = attRes.rows[0].id;

  await pool.query(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES ('alex.rivera@example.com', $1, 'Alex Rivera (Attendee)', 'attendee')
    ON CONFLICT (email) DO UPDATE SET password_hash = $1;
  `, [passHashPass]);

  // 3. Demo Event 1 (AI Summit)
  const evDate = new Date(Date.now() + 86400000 * 2).toISOString();
  const ev1Res = await pool.query(`
    INSERT INTO events (organizer_id, name, event_date, capacity, registered_count)
    VALUES ($1, 'Global AI & Cloud Summit 2026', $2, 100, 21)
    RETURNING id;
  `, [organizerId, evDate]);
  const eventId = ev1Res.rows[0].id;

  // 4. Register Jane Doe
  const qrSecret = crypto.randomBytes(16).toString('hex');
  const regRes = await pool.query(`
    INSERT INTO registrations (event_id, user_id, qr_secret)
    VALUES ($1, $2, $3)
    ON CONFLICT (event_id, user_id) DO UPDATE SET qr_secret = $3
    RETURNING id;
  `, [eventId, attendeeId, qrSecret]);
  const regId = regRes.rows[0].id;

  // 5. Seed other attendees and some existing check-ins for rich charts
  for (let i = 1; i <= 20; i++) {
    const email = `attendee_${i}@demo.local`;
    const uRes = await pool.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, 'attendee')
      ON CONFLICT (email) DO UPDATE SET name = $3
      RETURNING id;
    `, [email, passHashDefault, `Attendee #${i}`]);

    const rRes = await pool.query(`
      INSERT INTO registrations (event_id, user_id, qr_secret)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, user_id) DO NOTHING
      RETURNING id;
    `, [eventId, uRes.rows[0].id, crypto.randomBytes(16).toString('hex')]);

    if (rRes.rows.length > 0 && i <= 10) {
      // Check in 10 attendees with staggered timestamps
      const checkinTime = new Date(Date.now() - (10 - i) * 60000 * 5).toISOString();
      await pool.query(`
        INSERT INTO check_ins (registration_id, checked_in_at, station_id, source)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (registration_id) DO NOTHING;
      `, [rRes.rows[0].id, checkinTime, i % 2 === 0 ? 'gate-north' : 'gate-south', 'online']);
    }
  }

  // 6. Demo Event 2 (Capacity capped at 5)
  await pool.query(`
    INSERT INTO events (organizer_id, name, event_date, capacity, registered_count)
    VALUES ($1, 'Exclusive VIP Workshop (Strict Cap: 5)', $2, 5, 0);
  `, [organizerId, new Date(Date.now() + 86400000 * 4).toISOString()]);

  console.log('✓ Demo data successfully seeded!');
  console.log(`Event ID: ${eventId}`);
  console.log(`Jane Doe Registration ID: ${regId}`);

  await pool.end();
}

seed().catch(console.error);
