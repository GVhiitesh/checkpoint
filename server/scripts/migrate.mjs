import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

let url = process.env.DATABASE_URL;
if (process.env.DB_PASSWORD) {
  url = (url ?? '').replace('[YOUR-PASSWORD]', encodeURIComponent(process.env.DB_PASSWORD));
}
if (!url) {
  console.error('DATABASE_URL is not set. Put it in server/.env first.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(schema);
  console.log('✓ schema applied');
} catch (err) {
  console.error('✗ migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
