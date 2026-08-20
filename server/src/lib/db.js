import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: (config.databaseUrl ?? '').includes('localhost') ? false : { rejectUnauthorized: false },
  max: parseInt(process.env.POOL_MAX ?? '8', 10),
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initDatabase() {
  if (!config.databaseUrl) return;
  try {
    const check = await pool.query(
      "SELECT to_regclass('public.users') AS exists;"
    );
    if (!check.rows[0]?.exists) {
      console.log('[DB] New database detected. Applying schema.sql migrations...');
      const schemaPath = path.resolve(__dirname, '../../db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('[DB] ✓ Schema applied successfully.');

        // Seed default demo accounts
        const passHash = await bcrypt.hash('password123', 10);
        const orgRes = await pool.query(`
          INSERT INTO users (email, password_hash, name, role)
          VALUES ('organizer@checkpoint.io', $1, 'Alex Carter (Lead Organizer)', 'organizer')
          ON CONFLICT DO NOTHING RETURNING id;
        `, [passHash]);

        const attRes = await pool.query(`
          INSERT INTO users (email, password_hash, name, role)
          VALUES ('attendee@checkpoint.io', $1, 'Jane Doe (Attendee)', 'attendee')
          ON CONFLICT DO NOTHING RETURNING id;
        `, [passHash]);

        if (orgRes.rows.length > 0 && attRes.rows.length > 0) {
          const orgId = orgRes.rows[0].id;
          const attId = attRes.rows[0].id;
          const evDate = new Date(Date.now() + 86400000 * 2).toISOString();
          const evRes = await pool.query(`
            INSERT INTO events (organizer_id, name, event_date, capacity, registered_count)
            VALUES ($1, 'Global AI & Cloud Summit 2026', $2, 100, 1)
            RETURNING id;
          `, [orgId, evDate]);
          const evId = evRes.rows[0].id;

          await pool.query(`
            INSERT INTO registrations (event_id, user_id, qr_secret)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING;
          `, [evId, attId, crypto.randomBytes(16).toString('hex')]);
          console.log('[DB] ✓ Demo events and registrations seeded.');
        }
      }
    }
  } catch (err) {
    console.warn('[DB] Auto-migration notice:', err.message);
  }
}

export const UNIQUE_VIOLATION = '23505';
