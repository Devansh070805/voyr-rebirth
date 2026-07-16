/**
 * Fail fast in production when required secrets or security settings are missing.
 */
export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const required = [
    'JWT_SECRET',
    'DATABASE_URL',
    'RESEND_API_KEY',
    'CORS_ORIGIN',
    'FRONTEND_URL',
    'METRICS_TOKEN',
    'MAKCORPS_API_KEY',
    'GEOAPIFY_API_KEY',
    'AVIATION_STACK_API_KEY',
  ];

  for (const key of required) {
    if (!process.env[key]?.trim()) {
      throw new Error(`${key} must be set in production`);
    }
  }

  if (process.env.CORS_ORIGIN === '*') {
    throw new Error('CORS_ORIGIN must not be * in production');
  }

  if (process.env.JWT_SECRET === 'dev-jwt-secret-change-in-production') {
    throw new Error('JWT_SECRET must not use the default dev value in production');
  }
}
