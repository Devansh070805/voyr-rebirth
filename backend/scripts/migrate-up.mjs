/**
 * Run migrations with dotenv + Supabase-compatible SSL (matches src/db/index.ts).
 */
import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveDatabaseUrl } from './resolve-database-url.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });

if (!process.env.NODE_OPTIONS?.includes('ipv6first')) {
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--dns-result-order=ipv6first']
    .filter(Boolean)
    .join(' ');
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required in backend/.env');
  process.exit(1);
}

try {
  const resolved = resolveDatabaseUrl(process.env.DATABASE_URL);
  if (resolved !== process.env.DATABASE_URL) {
    const masked = resolved.replace(/:([^:@/]+)@/, ':***@');
    console.log(`Using Supabase session pooler: ${masked}`);
    process.env.DATABASE_URL = resolved;
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

if (process.env.DB_SSL === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const result = spawnSync(
  'npx',
  [
    'node-pg-migrate',
    'up',
    '--migrations-dir',
    'src/db/migrations',
    '--migration-file-language',
    'ts',
    '--tsx',
  ],
  { cwd: root, stdio: 'inherit', shell: true, env: process.env },
);

process.exit(result.status ?? 1);
