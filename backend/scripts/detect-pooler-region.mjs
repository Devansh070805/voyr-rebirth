import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const parsed = new URL(raw.replace(/^postgresql:/i, 'postgres:'));
const ref = parsed.hostname.match(/^db\.([^.]+)\./)?.[1];
if (!ref) {
  console.error('Not a direct db.*.supabase.co URL');
  process.exit(1);
}

const pass = parsed.password;
const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'us-east-1',
  'us-west-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-central-2',
  'eu-north-1',
  'ca-central-1',
  'sa-east-1',
];

const candidates = [];
for (const region of regions) {
  for (const prefix of ['aws-0', 'aws-1']) {
    for (const port of [6543, 5432]) {
      candidates.push({
        region,
        url: `postgresql://postgres.${ref}:${pass}@${prefix}-${region}.pooler.supabase.com:${port}/postgres`,
      });
    }
  }
}
candidates.push({
  region: 'db-host-6543',
  url: `postgresql://postgres.${ref}:${pass}@db.${ref}.supabase.co:6543/postgres`,
});
candidates.push({
  region: 'db-host-5432-pooler-user',
  url: `postgresql://postgres:${pass}@db.${ref}.supabase.co:6543/postgres`,
});

for (const { region, url } of candidates) {
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await pool.query('SELECT 1');
    console.log(region);
    console.log(url.replace(/:([^:@/]+)@/, ':***@'));
    await pool.end();
    process.exit(0);
  } catch (err) {
    const msg = err.message.split('\n')[0];
    if (!msg.includes('ENOTFOUND') && !msg.includes('tenant/user')) {
      console.error(`${region}: ${msg}`);
    }
    await pool.end().catch(() => {});
  }
}

process.exit(1);
