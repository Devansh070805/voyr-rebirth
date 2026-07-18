import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createAuthService } from './auth.service.js';
import * as db from '../../db/index.js';
import { UnauthorizedError } from '../../infra/error-handler.js';

vi.mock('../../db/index.js');
vi.mock('../../infra/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../infra/index.js')>();
  return {
    ...actual,
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  };
});
vi.mock('../partner/partner.service.js', () => ({
  createPartnerService: () => ({
    syncUserSegment: vi.fn(),
  }),
}));

const TEST_EMAIL = 'user@example.com';
const TEST_PASSWORD = 'Password123';
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';

// Same hashing logic as in auth.service.ts
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

describe('Auth Service (Password)', () => {
  let service: ReturnType<typeof createAuthService>;
  const mockTransaction = db.transaction as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createAuthService();

    mockTransaction.mockImplementation(async (callback: any) => {
      const mockClient = {
        query: vi.fn().mockImplementation((queryText: string, params?: any[]) => {
          if (queryText.includes('SELECT id, email, password_hash FROM users WHERE email')) {
             if (params && params[0] === 'newuser@example.com') {
               return Promise.resolve({ rows: [] }); // User does not exist
             }
             return Promise.resolve({ rows: [{ id: TEST_USER_ID, email: TEST_EMAIL, password_hash: hashPassword(TEST_PASSWORD) }] });
          }
          if (queryText.includes('INSERT INTO users')) {
            return Promise.resolve({ rows: [{ id: TEST_USER_ID, email: params?.[0] }] });
          }
          if (queryText.includes('UPDATE users SET password_hash')) {
            return Promise.resolve({ rows: [{ id: TEST_USER_ID, email: params?.[0] }] });
          }
          if (queryText.includes('INSERT INTO refresh_tokens')) {
            return Promise.resolve();
          }
          return Promise.resolve({ rows: [] });
        }),
      };
      return callback(mockClient);
    });
  });

  describe('register', () => {
    it('should create a user and return tokens when user does not exist', async () => {
      const result = await service.register('newuser@example.com', TEST_PASSWORD);

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });

    it('should update password and return tokens when user exists but has no password (legacy OTP user)', async () => {
      mockTransaction.mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation((queryText: string, params?: any[]) => {
            if (queryText.includes('SELECT id, email, password_hash FROM users WHERE email')) {
              return Promise.resolve({ rows: [{ id: TEST_USER_ID, email: TEST_EMAIL, password_hash: null }] }); // Exists, no password
            }
            if (queryText.includes('UPDATE users SET password_hash')) {
              return Promise.resolve();
            }
            if (queryText.includes('INSERT INTO refresh_tokens')) {
              return Promise.resolve();
            }
            return Promise.resolve({ rows: [] });
          }),
        };
        return callback(mockClient);
      });
      const result = await service.register(TEST_EMAIL, TEST_PASSWORD);
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });

    it('should throw if user already exists and HAS a password', async () => {
      await expect(service.register(TEST_EMAIL, TEST_PASSWORD)).rejects.toThrow(UnauthorizedError);
      await expect(service.register(TEST_EMAIL, TEST_PASSWORD)).rejects.toThrow('Email already in use');
    });
  });

  describe('login', () => {
    it('should return tokens for correct credentials', async () => {
      const result = await service.login(TEST_EMAIL, TEST_PASSWORD);

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });

    it('should throw for incorrect password', async () => {
      await expect(service.login(TEST_EMAIL, 'wrongpassword')).rejects.toThrow(UnauthorizedError);
      await expect(service.login(TEST_EMAIL, 'wrongpassword')).rejects.toThrow('Invalid credentials');
    });

    it('should throw if user does not exist', async () => {
      await expect(service.login('newuser@example.com', TEST_PASSWORD)).rejects.toThrow(UnauthorizedError);
    });
  });
});
