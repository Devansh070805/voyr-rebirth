/**
 * JS mirror of src/db/database-url.ts for migration/verify scripts.
 */
const DIRECT_SUPABASE_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i;

export function resolveDatabaseUrl(rawUrl, env = process.env) {
  const poolerOverride = env.DATABASE_POOLER_URL?.trim();
  if (poolerOverride) return poolerOverride;

  if (!rawUrl?.trim()) return rawUrl;

  const url = rawUrl.trim();
  const parsed = new URL(url.replace(/^postgresql:/i, 'postgres:'));

  const hostMatch = parsed.hostname.match(DIRECT_SUPABASE_HOST);
  if (!hostMatch) return url;

  const usePooler =
    env.DB_USE_SUPABASE_POOLER === 'true' ||
    (env.NODE_ENV === 'production' && env.DB_USE_SUPABASE_POOLER !== 'false') ||
    (process.platform === 'win32' && !!env.SUPABASE_POOLER_REGION?.trim());

  if (!usePooler) return url;

  const region = env.SUPABASE_POOLER_REGION?.trim();
  if (!region) {
    throw new Error(
      'DATABASE_URL uses direct db.*.supabase.co which often fails on Windows. ' +
        'Set SUPABASE_POOLER_REGION in backend/.env (from Supabase → Connect → Session pooler), ' +
        'or paste the full pooler URI as DATABASE_URL. ' +
        'Run: node scripts/detect-pooler-region.mjs to auto-detect.',
    );
  }

  const projectRef = hostMatch[1];
  const poolerPrefix = env.SUPABASE_POOLER_PREFIX?.trim() || 'aws-0';
  parsed.username = `postgres.${projectRef}`;
  parsed.hostname = `${poolerPrefix}-${region}.pooler.supabase.com`;
  parsed.port = '6543';
  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/postgres';
  }

  return parsed.toString().replace(/^postgres:/i, 'postgresql:');
}
