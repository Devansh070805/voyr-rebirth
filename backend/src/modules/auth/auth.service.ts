import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query, queryOne, transaction } from '../../db/index.js';
import { createLogger } from '../../infra/index.js';
import { UnauthorizedError } from '../../infra/error-handler.js';
import { OAuth2Client } from 'google-auth-library';
import { createPartnerService } from '../partner/partner.service.js';

const logger = createLogger('auth-service');
const partnerService = createPartnerService();

export interface LoginResponse {
  success: boolean;
  message: string;
}

export interface VerifyResponse {
  access_token: string;
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  account_type?: string;
  account_id?: string;
  iat: number;
  exp: number;
}

export interface AuthService {
  register(email: string, password: string, accountType?: string): Promise<VerifyResponse>;
  login(email: string, password: string): Promise<VerifyResponse>;
  refreshToken(refreshToken: string): Promise<RefreshResponse>;
  revokeRefreshToken(refreshToken: string): Promise<void>;
  validateJwt(token: string): Promise<JwtPayload>;
  loginWithGoogle(idToken: string): Promise<VerifyResponse>;
}

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'dev-jwt-secret-change-in-production';
})();
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

const googleClient = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your-google-client-id');

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(userId: string, email: string, accountType?: string, accountId?: string): string {
  return jwt.sign(
    { sub: userId, email, account_type: accountType, account_id: accountId },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY },
  );
}

function signRefreshToken(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY },
  );
}

// Basic scrypt hashing for MVP
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, hash: string): boolean {
  if (!hash || !hash.includes(':')) return false;
  const [salt, key] = hash.split(':');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return key === derivedKey;
}

export function createAuthService(): AuthService {
  return {
    async register(email: string, password: string, accountType = 'Individual'): Promise<VerifyResponse> {
      const passwordHash = hashPassword(password);

      const result = await transaction(async (tx) => {
        // Check if user exists
        let user;
        const existing = await tx.query(`SELECT id, email, password_hash FROM users WHERE email = $1`, [email]);
        if (existing.rows.length > 0) {
          if (existing.rows[0].password_hash) {
            throw new UnauthorizedError('Email already in use');
          }
          // Legacy OTP user has no password yet, set it for them
          await tx.query(`UPDATE users SET password_hash = $2 WHERE email = $1`, [email, passwordHash]);
          user = existing.rows[0];
        } else {
          const userResult = await tx.query(
            `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
            [email, passwordHash],
          );
          user = userResult.rows[0];
        }

        // Create Account
        const accountResult = await tx.query(
          `INSERT INTO accounts (type, name) VALUES ($1, $2) RETURNING id`,
          [accountType, `${email.split('@')[0]}'s Account`]
        );
        const accountId = accountResult.rows[0].id;

        // Link User to Account
        await tx.query(
          `INSERT INTO user_accounts (user_id, account_id, role, is_primary) VALUES ($1, $2, $3, $4)`,
          [user.id, accountId, 'OWNER', true]
        );

        // Provision additional profiles based on type
        if (accountType === 'TravelAgent') {
          await tx.query(
            `INSERT INTO travel_agent_profiles (account_id, agency_name, contact_email) VALUES ($1, $2, $3)`,
            [accountId, `${email.split('@')[0]} Agency`, email]
          );
          // Also create a wallet
          await tx.query(
            `INSERT INTO wallets (account_id, balance, currency) VALUES ($1, $2, $3)`,
            [accountId, 0, 'USD']
          );
        } else if (accountType === 'Corporate') {
          await tx.query(
            `INSERT INTO corporate_profiles (account_id, company_name, contact_email) VALUES ($1, $2, $3)`,
            [accountId, `${email.split('@')[0]} Corp`, email]
          );
        }



        const accessToken = signAccessToken(user.id, user.email, accountType, accountId);
        const refreshToken = signRefreshToken(user.id, user.email);

        await tx.query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, hashToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        logger.info('User registered', { userId: user.id });

        return {
          user_id: user.id,
          access_token: accessToken,
          refresh_token: refreshToken,
        };
      });

      await partnerService.syncUserSegment(result.user_id, email);

      return {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      };
    },

    async login(email: string, password: string): Promise<VerifyResponse> {
      return transaction(async (tx) => {
        const userResult = await tx.query(
          `SELECT id, email, password_hash FROM users WHERE email = $1`,
          [email],
        );

        if (userResult.rows.length === 0) {
          throw new UnauthorizedError('Invalid credentials');
        }

        const user = userResult.rows[0];

        if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
          throw new UnauthorizedError('Invalid credentials');
        }

        await partnerService.syncUserSegment(user.id, user.email);

        // Fetch primary account
        const accountResult = await tx.query(
          `SELECT a.id, a.type FROM accounts a
           JOIN user_accounts ua ON ua.account_id = a.id
           WHERE ua.user_id = $1 AND ua.is_primary = true LIMIT 1`,
          [user.id]
        );
        let accountId;
        let accountType;
        if (accountResult.rows.length > 0) {
          accountId = accountResult.rows[0].id;
          accountType = accountResult.rows[0].type;
        }

        const accessToken = signAccessToken(user.id, user.email, accountType, accountId);
        const refreshToken = signRefreshToken(user.id, user.email);

        await tx.query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, hashToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        logger.info('User authenticated via password', { userId: user.id });

        return {
          access_token: accessToken,
          refresh_token: refreshToken,
        };
      });
    },

    async refreshToken(refreshToken: string): Promise<RefreshResponse> {
      try {
        const payload = jwt.verify(refreshToken, JWT_SECRET) as jwt.JwtPayload & { type?: string };

        if (payload.type !== 'refresh') {
          throw new UnauthorizedError('Invalid refresh token');
        }

        const tokenHash = hashToken(refreshToken);

        const record = await queryOne<{ id: string; revoked_at: Date | null }>(
          `SELECT id, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
          [tokenHash]
        );

        if (!record || record.revoked_at) {
          throw new UnauthorizedError('Refresh token revoked or invalid');
        }

        const user = await queryOne<{ id: string; email: string }>(
          `SELECT id, email FROM users WHERE id = $1`,
          [payload.sub],
        );

        if (!user) {
          throw new UnauthorizedError('Invalid refresh token');
        }

        const accessToken = signAccessToken(user.id, user.email);

        return { access_token: accessToken };
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        throw new UnauthorizedError('Invalid or expired refresh token');
      }
    },

    async revokeRefreshToken(refreshToken: string): Promise<void> {
      const tokenHash = hashToken(refreshToken);
      await query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
        [tokenHash]
      );
    },

    async validateJwt(token: string): Promise<JwtPayload> {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
        return payload;
      } catch {
        throw new UnauthorizedError('Invalid or expired token');
      }
    },

    async loginWithGoogle(idToken: string): Promise<VerifyResponse> {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your-google-client-id',
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          throw new UnauthorizedError('Invalid Google token payload');
        }
        
        const email = payload.email.toLowerCase();
        const { sub, name, picture } = payload;

        const result = await queryOne<{ id: string; email: string }>(
          `INSERT INTO users (email, google_id, auth_provider, display_name, avatar_url)
           VALUES ($1, $2, 'google', $3, $4)
           ON CONFLICT (email) DO UPDATE 
           SET google_id = EXCLUDED.google_id,
               auth_provider = 'google',
               display_name = COALESCE(users.display_name, EXCLUDED.display_name),
               avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url)
           RETURNING id, email`,
          [email, sub, name, picture]
        );
        const user = result;

        if (!user) {
          throw new UnauthorizedError('Failed to create or fetch user');
        }

        await partnerService.syncUserSegment(user.id, user.email);

        const accessToken = signAccessToken(user.id, user.email);
        const refreshToken = signRefreshToken(user.id, user.email);

        await query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, hashToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        logger.info('User authenticated via Google', { userId: user.id });

        return {
          access_token: accessToken,
          refresh_token: refreshToken,
        };
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        logger.error('Google auth failed', { error: err });
        throw err;
      }
    },
  };
}
