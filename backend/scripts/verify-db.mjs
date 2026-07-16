import { config } from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });

if (process.env.DB_SSL === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const tables = await pool.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`,
);
const migrations = await pool.query(`SELECT name FROM pgmigrations ORDER BY run_on`);
const visa = await pool.query(`SELECT COUNT(*)::int AS n FROM travel_visa_requirements`).catch(() => ({ rows: [{ n: 0 }] }));

console.log(`Connected: ${process.env.SUPABASE_PROJECT_REF || 'supabase'}`);
console.log(`Tables: ${tables.rows.length}`);
tables.rows.forEach((r) => console.log(`  - ${r.tablename}`));
console.log(`Migrations applied: ${migrations.rows.length}`);
console.log(`Visa requirement rows: ${visa.rows[0].n}`);

await pool.end();
