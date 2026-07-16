/**
 * Unit tests for the Auth Service.
 *
 * Tests:
 * - OTP generation and verification flow (Req 1.1, 1.2)
 * - Expired OTP rejection (Req 1.4)
 * - Incorrect OTP returns generic error (Req 1.3)
 * - JWT issuance and refresh (Req 1.2, 1.5)
 *
 * Strategy: Mock the database layer to isolate AuthService logic.
 * Verify correct SQL calls, OTP handling, JWT issuance, and error cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { createAuthService } from './auth.service.js';
import type { AuthService } from './auth.service.js';


const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../../db/index.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: unknown) => mockTransaction(fn),
}));

vi.mock('../../infra/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));


const JWT_SECRET = 'dev-jwt-secret-change-in-production';
const TEST_EMAIL = 'user@example.com';
const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';


function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function createMockClient() {
  return { query: vi.fn() };
}

function otpRecord(
  otp: string,
  overrides: Partial<{ expires_at: Date; attempts: number }> = {},
) {
  return {
    email: TEST_EMAIL,
    otp_hash: hashOtp(otp),
    expires_at: overrides.expires_at ?? new Date(Date.now() + 10 * 60 * 1000),
    attempts: overrides.attempts ?? 0,
  };
}

function mockVerifyOtpQueries(
  record: Record<string, unknown> | null,
  options?: { user?: { id: string; email: string } | null },
) {
  const mockClient = createMockClient();
  mockClient.query
    .mockResolvedValueOnce({ rows: record ? [record] : [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows:
        options?.user === null
          ? []
          : [options?.user ?? { id: TEST_USER_ID, email: TEST_EMAIL }],
    })
    .mockResolvedValueOnce({ rows: [] });
  mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
    fn(mockClient),
  );
  return mockClient;
}


describe('Auth Service — Unit Tests', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createAuthService();
  });


  describe('sendOtp', () => {
    it('should return success when OTP is sent for a valid email', async () => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValue({ rows: [] });

      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));

      const result = await service.sendOtp(TEST_EMAIL);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });

    it('should upsert the user in the database', async () => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValue({ rows: [] });

      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));

      await service.sendOtp(TEST_EMAIL);

      // First query in the transaction should be the user upsert
      const userUpsertCall = mockClient.query.mock.calls[0];
      expect(userUpsertCall[0]).toContain('INSERT INTO users');
      expect(userUpsertCall[0]).toContain('ON CONFLICT');
      expect(userUpsertCall[1]).toContain(TEST_EMAIL);
    });

    it('should store a hashed OTP with expiry in otp_codes table', async () => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValue({ rows: [] });

      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));

      await service.sendOtp(TEST_EMAIL);

      // Second query should be the OTP upsert
      const otpUpsertCall = mockClient.query.mock.calls[1];
      expect(otpUpsertCall[0]).toContain('INSERT INTO otp_codes');
      expect(otpUpsertCall[1][0]).toBe(TEST_EMAIL);
      // The OTP hash should be a 64-char hex string (SHA-256)
      expect(otpUpsertCall[1][1]).toMatch(/^[a-f0-9]{64}$/);
      // The expiry should be a future ISO timestamp
      const expiresAt = new Date(otpUpsertCall[1][2]);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should use a transaction for user upsert and OTP storage', async () => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValue({ rows: [] });

      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));

      await service.sendOtp(TEST_EMAIL);

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });
  });


  describe('verifyOtp — success flow', () => {
    it('should return access and refresh tokens for a valid OTP', async () => {
      const otp = '123456';
      mockVerifyOtpQueries(otpRecord(otp));

      const result = await service.verifyOtp(TEST_EMAIL, otp);

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(typeof result.access_token).toBe('string');
      expect(typeof result.refresh_token).toBe('string');
    });

    it('should issue a valid JWT access token with correct payload', async () => {
      const otp = '654321';
      mockVerifyOtpQueries(otpRecord(otp));

      const result = await service.verifyOtp(TEST_EMAIL, otp);

      const decoded = jwt.verify(result.access_token, JWT_SECRET) as jwt.JwtPayload;
      expect(decoded.sub).toBe(TEST_USER_ID);
      expect(decoded.email).toBe(TEST_EMAIL);
      expect(decoded.exp).toBeDefined();
    });

    it('should issue a refresh token with type "refresh"', async () => {
      const otp = '111111';
      mockVerifyOtpQueries(otpRecord(otp));

      const result = await service.verifyOtp(TEST_EMAIL, otp);

      const decoded = jwt.verify(result.refresh_token, JWT_SECRET) as jwt.JwtPayload & { type?: string };
      expect(decoded.type).toBe('refresh');
      expect(decoded.sub).toBe(TEST_USER_ID);
    });

    it('should delete the OTP record after successful verification', async () => {
      const otp = '222222';
      const mockClient = mockVerifyOtpQueries(otpRecord(otp));

      await service.verifyOtp(TEST_EMAIL, otp);

      const deleteCall = mockClient.query.mock.calls[3];
      expect(deleteCall[0]).toContain('DELETE FROM otp_codes');
      expect(deleteCall[1]).toContain(TEST_EMAIL);
    });
  });


  describe('verifyOtp — incorrect OTP', () => {
    it('should throw a generic error for an incorrect OTP without revealing email existence', async () => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [otpRecord('123456')] })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
        fn(mockClient),
      );

      await expect(service.verifyOtp(TEST_EMAIL, '999999')).rejects.toThrow('Invalid credentials');
    });

    it('should throw a generic error when no OTP record exists for the email', async () => {
      mockVerifyOtpQueries(null);

      await expect(service.verifyOtp('unknown@example.com', '123456')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should increment the attempts counter on incorrect OTP', async () => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [otpRecord('123456')] })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
        fn(mockClient),
      );

      await expect(service.verifyOtp(TEST_EMAIL, '999999')).rejects.toThrow('Invalid credentials');

      const updateCall = mockClient.query.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE otp_codes SET attempts');
      expect(updateCall[1]).toContain(TEST_EMAIL);
    });

    it('should reject with generic error when max attempts exceeded', async () => {
      mockVerifyOtpQueries(otpRecord('123456', { attempts: 5 }));

      await expect(service.verifyOtp(TEST_EMAIL, '123456')).rejects.toThrow('Too many attempts');
    });
  });


  describe('verifyOtp — expired OTP', () => {
    it('should throw an expiration error when OTP has expired', async () => {
      const otp = '123456';
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [otpRecord(otp, { expires_at: new Date(Date.now() - 60 * 1000) })],
        })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
        fn(mockClient),
      );

      await expect(service.verifyOtp(TEST_EMAIL, otp)).rejects.toThrow(/expired/i);
    });

    it('should prompt the user to request a new code on expiry', async () => {
      const otp = '123456';
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({
          rows: [otpRecord(otp, { expires_at: new Date(Date.now() - 5 * 60 * 1000) })],
        })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
        fn(mockClient),
      );

      await expect(service.verifyOtp(TEST_EMAIL, otp)).rejects.toThrow(/new/i);
    });
  });


  describe('refreshToken', () => {
    it('should issue a new access token for a valid refresh token', async () => {
      // Create a valid refresh token
      const refreshToken = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' },
      );

      mockQueryOne
        .mockResolvedValueOnce({ id: 'refresh-row-id', revoked_at: null })
        .mockResolvedValueOnce({ id: TEST_USER_ID, email: TEST_EMAIL });

      const result = await service.refreshToken(refreshToken);

      expect(result.access_token).toBeDefined();
      expect(typeof result.access_token).toBe('string');

      // Verify the new access token is valid
      const decoded = jwt.verify(result.access_token, JWT_SECRET) as jwt.JwtPayload;
      expect(decoded.sub).toBe(TEST_USER_ID);
      expect(decoded.email).toBe(TEST_EMAIL);
    });

    it('should reject an expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '-1s' }, // already expired
      );

      await expect(service.refreshToken(expiredToken))
        .rejects.toThrow(/invalid|expired/i);
    });

    it('should reject a token that is not a refresh token (missing type)', async () => {
      // Sign an access token (no type: 'refresh')
      const accessToken = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL },
        JWT_SECRET,
        { expiresIn: '15m' },
      );

      await expect(service.refreshToken(accessToken))
        .rejects.toThrow(/invalid/i);
    });

    it('should reject a refresh token signed with a wrong secret', async () => {
      const badToken = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL, type: 'refresh' },
        'wrong-secret',
        { expiresIn: '7d' },
      );

      await expect(service.refreshToken(badToken))
        .rejects.toThrow(/invalid|expired/i);
    });

    it('should reject a refresh token if the user no longer exists', async () => {
      const refreshToken = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' },
      );

      mockQueryOne
        .mockResolvedValueOnce({ id: 'refresh-row-id', revoked_at: null })
        .mockResolvedValueOnce(null);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(/invalid/i);
    });

    it('should not require re-authentication for a valid refresh', async () => {
      const refreshToken = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' },
      );

      mockQueryOne
        .mockResolvedValueOnce({ id: 'refresh-row-id', revoked_at: null })
        .mockResolvedValueOnce({ id: TEST_USER_ID, email: TEST_EMAIL });

      const result = await service.refreshToken(refreshToken);

      expect(result.access_token).toBeDefined();
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });


  describe('validateJwt', () => {
    it('should return the payload for a valid JWT', async () => {
      const token = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL },
        JWT_SECRET,
        { expiresIn: '15m' },
      );

      const payload = await service.validateJwt(token);

      expect(payload.sub).toBe(TEST_USER_ID);
      expect(payload.email).toBe(TEST_EMAIL);
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
    });

    it('should throw for an expired JWT', async () => {
      const token = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL },
        JWT_SECRET,
        { expiresIn: '-1s' },
      );

      await expect(service.validateJwt(token))
        .rejects.toThrow(/invalid|expired/i);
    });

    it('should throw for a JWT signed with a wrong secret', async () => {
      const token = jwt.sign(
        { sub: TEST_USER_ID, email: TEST_EMAIL },
        'wrong-secret',
        { expiresIn: '15m' },
      );

      await expect(service.validateJwt(token))
        .rejects.toThrow(/invalid|expired/i);
    });

    it('should throw for a malformed token', async () => {
      await expect(service.validateJwt('not-a-jwt'))
        .rejects.toThrow(/invalid|expired/i);
    });
  });
});
