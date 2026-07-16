import dns from 'node:dns';

/** Prefer IPv4 on cloud hosts (Railway, etc.) that lack IPv6 egress to Supabase direct hosts. */
dns.setDefaultResultOrder('ipv4first');

const DIRECT_SUPABASE_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i;

/**
 * Resolve DATABASE_URL for the current environment.
 *
 * Supabase direct `db.*.supabase.co:5432` is IPv6-only and fails on many hosts
 * (Railway ENETUNREACH). In production, rewrite to the session pooler when
 * SUPABASE_POOLER_REGION or DATABASE_POOLER_URL is configured.
 */
export function resolveDatabaseUrl(rawUrl: string | undefined): string | undefined {
  const poolerOverride = process.env.DATABASE_POOLER_URL?.trim();
  if (poolerOverride) {
    return poolerOverride;
  }

  if (!rawUrl?.trim()) {
    return rawUrl;
  }

  const url = rawUrl.trim();
  const parsed = new URL(url.replace(/^postgresql:/i, 'postgres:'));

  const hostMatch = parsed.hostname.match(DIRECT_SUPABASE_HOST);
  if (!hostMatch) {
    return url;
  }

  const usePooler =
    process.env.DB_USE_SUPABASE_POOLER === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.DB_USE_SUPABASE_POOLER !== 'false');

  if (!usePooler) {
    return url;
  }

  const region = process.env.SUPABASE_POOLER_REGION?.trim();
  if (!region) {
    throw new Error(
      'DATABASE_URL uses direct db.*.supabase.co (IPv6-only). ' +
        'Set SUPABASE_POOLER_REGION (e.g. ap-southeast-2) or DATABASE_POOLER_URL for Railway/production.',
    );
  }

  const projectRef = hostMatch[1];
  const poolerPrefix = process.env.SUPABASE_POOLER_PREFIX?.trim() || 'aws-0';
  parsed.username = `postgres.${projectRef}`;
  parsed.hostname = `${poolerPrefix}-${region}.pooler.supabase.com`;
  parsed.port = '6543';
  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/postgres';
  }

  return parsed.toString().replace(/^postgres:/i, 'postgresql:');
}
