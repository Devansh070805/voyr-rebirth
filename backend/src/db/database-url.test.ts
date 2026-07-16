import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveDatabaseUrl } from './database-url.js';

/** Fake URLs only — never use real project refs or passwords in tests. */
const FAKE_PROJECT_REF = 'testprojectref';
const FAKE_PASSWORD = 'test-password-placeholder';

describe('resolveDatabaseUrl', () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...prevEnv };
  });

  afterEach(() => {
    process.env = prevEnv;
  });

  it('returns DATABASE_POOLER_URL when set', () => {
    process.env.DATABASE_POOLER_URL = 'postgresql://pooler.example/postgres';
    expect(resolveDatabaseUrl('postgresql://direct.example/postgres')).toBe(
      'postgresql://pooler.example/postgres',
    );
  });

  it('rewrites direct Supabase host in production when region is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_POOLER_REGION = 'ap-southeast-2';
    process.env.SUPABASE_POOLER_PREFIX = 'aws-1';
    const input = `postgresql://postgres:${FAKE_PASSWORD}@db.${FAKE_PROJECT_REF}.supabase.co:5432/postgres`;
    expect(resolveDatabaseUrl(input)).toBe(
      `postgresql://postgres.${FAKE_PROJECT_REF}:${FAKE_PASSWORD}@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres`,
    );
  });

  it('keeps direct host in development', () => {
    process.env.NODE_ENV = 'development';
    const input = `postgresql://postgres:${FAKE_PASSWORD}@db.${FAKE_PROJECT_REF}.supabase.co:5432/postgres`;
    expect(resolveDatabaseUrl(input)).toBe(input);
  });

  it('throws in production without pooler region', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SUPABASE_POOLER_REGION;
    delete process.env.DATABASE_POOLER_URL;
    expect(() =>
      resolveDatabaseUrl(
        `postgresql://postgres:${FAKE_PASSWORD}@db.${FAKE_PROJECT_REF}.supabase.co:5432/postgres`,
      ),
    ).toThrow(/SUPABASE_POOLER_REGION/);
  });
});
