/**
 * Auth Service — Email OTP login, JWT access tokens, refresh tokens.
 *
 * Implements the AuthService interface from the design document.
 * - sendOtp(email): generate 6-digit OTP, store with expiry, send via email provider
 * - verifyOtp(email, otp): validate OTP, return JWT access + refresh tokens
 * - refreshToken(refreshToken): validate refresh token, issue new access token
 * - validateJwt(token): decode and verify JWT, return payload
 */

import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query, queryOne, transaction } from '../../db/index.js';
import { createLogger } from '../../infra/index.js';
import { UnauthorizedError } from '../../infra/error-handler.js';
import { getResendFromAddress, logResendFailure } from '../../infra/resend.js';
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
  iat: number;
  exp: number;
}

export interface AuthService {
  sendOtp(email: string): Promise<LoginResponse>;
  verifyOtp(email: string, otp: string): Promise<VerifyResponse>;
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
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

const googleClient = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your-google-client-id');

/**
 * Generate a cryptographically random 6-digit OTP.
 */
function generateOtp(): string {
  const num = crypto.randomInt(0, 1_000_000);
  return num.toString().padStart(6, '0');
}

/**
 * Hash a string (OTP or refresh token) for storage.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Sign a JWT access token.
 */
function signAccessToken(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY },
  );
}

/**
 * Sign a JWT refresh token (longer-lived).
 */
function signRefreshToken(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY },
  );
}

/**
 * Send OTP email via Resend.
 * In development, OTP is only logged when DEV_LOG_OTP=true (never in production).
 */
async function sendOtpEmail(email: string, otp: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required in production');
    }
    if (process.env.DEV_LOG_OTP === 'true') {
      logger.info(`[DEV] OTP for ${email}: ${otp}`);
    } else {
      logger.info('[DEV] OTP generated (set DEV_LOG_OTP=true to log code; RESEND not configured)', { email });
    }
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getResendFromAddress(),
      to: [email],
      subject: 'Your Voyr Login Code',
      html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`,
    }),
  });

  if (!response.ok) {
    throw await logResendFailure(logger, response, { email, context: 'otp' });
  }

  logger.info('OTP email sent', { email });
}

export function createAuthService(): AuthService {
  return {
    async sendOtp(email: string): Promise<LoginResponse> {
      const otp = generateOtp();
      const otpHash = hashToken(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await transaction(async (client) => {
        await client.query(
          `INSERT INTO users (email) VALUES ($1)
           ON CONFLICT (email) DO NOTHING`,
          [email],
        );

        await client.query(
          `INSERT INTO otp_codes (email, otp_hash, expires_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET otp_hash = $2, expires_at = $3, attempts = 0`,
          [email, otpHash, expiresAt.toISOString()],
        );
      });

      await sendOtpEmail(email, otp);

      logger.info('OTP sent', { email });
      return { success: true, message: 'Verification code sent to your email' };
    },

    async verifyOtp(email: string, otp: string): Promise<VerifyResponse> {
      const otpHash = hashToken(otp);

      return transaction(async (tx) => {
        const record = await tx.query(
          `SELECT email, otp_hash, expires_at, attempts FROM otp_codes WHERE email = $1`,
          [email],
        );

        if (record.rows.length === 0) {
          throw new UnauthorizedError('Invalid credentials');
        }

        const otpRecord = record.rows[0];

        if (otpRecord.attempts >= 5) {
          throw new UnauthorizedError('Too many attempts. Please request a new code.');
        }

        await tx.query(
          `UPDATE otp_codes SET attempts = attempts + 1 WHERE email = $1`,
          [email],
        );

        if (new Date() > new Date(otpRecord.expires_at)) {
          throw new UnauthorizedError('Code expired. Please request a new one.');
        }

        if (otpRecord.otp_hash !== otpHash) {
          throw new UnauthorizedError('Invalid credentials');
        }

        const userResult = await tx.query(
          `SELECT id, email FROM users WHERE email = $1`,
          [email],
        );

        if (userResult.rows.length === 0) {
          throw new UnauthorizedError('Invalid credentials');
        }

        const user = userResult.rows[0];

        await tx.query(`DELETE FROM otp_codes WHERE email = $1`, [email]);

        await partnerService.syncUserSegment(user.id, user.email);

        const accessToken = signAccessToken(user.id, user.email);
        const refreshToken = signRefreshToken(user.id, user.email);

        await tx.query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, hashToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        logger.info('User authenticated via OTP', { userId: user.id });

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
          // Token reused or revoked, could be a security risk. Best practice is to revoke all user's tokens, but here we just deny
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
