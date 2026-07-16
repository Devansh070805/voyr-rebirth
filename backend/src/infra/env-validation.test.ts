import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateProductionEnvironment } from './env-validation.js';

describe('validateProductionEnvironment', () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...prevEnv };
  });

  afterEach(() => {
    process.env = prevEnv;
  });

  it('does nothing outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it('throws when CORS_ORIGIN is * in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret';
    process.env.DATABASE_URL = 'postgresql://localhost/voyr';
    process.env.RESEND_API_KEY = 're_test';
    process.env.CORS_ORIGIN = '*';
    process.env.FRONTEND_URL = 'https://example.com';
    process.env.METRICS_TOKEN = 'metrics-token';
    process.env.MAKCORPS_API_KEY = 'makcorps-key';
    process.env.GEOAPIFY_API_KEY = 'geoapify-key';
    process.env.AVIATION_STACK_API_KEY = 'aviation-key';

    expect(() => validateProductionEnvironment()).toThrow(/CORS_ORIGIN/);
  });

  it('throws when required secrets are missing in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret';
    process.env.DATABASE_URL = 'postgresql://localhost/voyr';
    process.env.RESEND_API_KEY = 're_test';
    process.env.CORS_ORIGIN = 'https://example.com';
    process.env.FRONTEND_URL = 'https://example.com';
    process.env.MAKCORPS_API_KEY = 'makcorps-key';
    process.env.GEOAPIFY_API_KEY = 'geoapify-key';
    process.env.AVIATION_STACK_API_KEY = 'aviation-key';
    delete process.env.METRICS_TOKEN;

    expect(() => validateProductionEnvironment()).toThrow(/METRICS_TOKEN/);
  });
});
