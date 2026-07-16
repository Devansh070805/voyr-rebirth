import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Request } from 'express';
import { isAdminRequest } from './admin.middleware.js';

function mockReq(headers: Record<string, string>): Request {
  return { headers } as Request;
}

describe('isAdminRequest', () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_USER_IDS;
    process.env.NODE_ENV = 'test';
  });

  it('denies when x-user-id is missing', () => {
    expect(isAdminRequest(mockReq({ 'x-user-email': 'a@b.com' }))).toBe(false);
  });

  it('allows when email is in ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'ops@voyr.com';
    expect(
      isAdminRequest(
        mockReq({ 'x-user-id': 'u1', 'x-user-email': 'ops@voyr.com' }),
      ),
    ).toBe(true);
  });

  it('denies when email is not allowlisted in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAILS = 'ops@voyr.com';
    expect(
      isAdminRequest(
        mockReq({ 'x-user-id': 'u1', 'x-user-email': 'other@voyr.com' }),
      ),
    ).toBe(false);
  });
});
