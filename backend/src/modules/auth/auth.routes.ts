/**
 * Auth Routes — Express router for authentication endpoints.
 *
 * POST /auth/register — Register with email/password
 * POST /auth/login    — Login with email/password
 * POST /auth/refresh  — Refresh access token
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createAuthService } from './auth.service.js';
import { ValidationError } from '../../infra/error-handler.js';
import { createPartnerService } from '../partner/partner.service.js';

const router = Router();
const authService = createAuthService();
const partnerService = createPartnerService();


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: unknown): string {
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new ValidationError('Invalid email format');
  }
  const cleaned = email.trim().toLowerCase();
  if (cleaned.length > 254) {
    throw new ValidationError('Invalid email');
  }
  return cleaned;
}

function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long');
  }
  return password;
}

function validateRefreshToken(token: unknown): string {
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new ValidationError('Refresh token is required');
  }
  return token.trim();
}


/**
 * POST /auth/register
 * Body: { email: string, password: string, accountType?: string }
 * Response: { access_token: string, refresh_token: string }
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = validateEmail(req.body.email);
    const password = validatePassword(req.body.password);
    const accountType = req.body.accountType;
    const result = await authService.register(email, password, accountType);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/login
 * Body: { email: string, password: string }
 * Response: { access_token: string, refresh_token: string }
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = validateEmail(req.body.email);
    const password = validatePassword(req.body.password);
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/refresh
 * Body: { refresh_token: string }
 * Response: { access_token: string }
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = validateRefreshToken(req.body.refresh_token);
    const result = await authService.refreshToken(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/google
 * Body: { credential: string }
 * Response: { access_token: string, refresh_token: string }
 */
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = req.body;
    if (typeof credential !== 'string' || credential.trim().length === 0) {
      throw new ValidationError('Google credential is required');
    }
    const result = await authService.loginWithGoogle(credential.trim());
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/me — current user profile including B2B segment and partner info.
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || '';
    const email = ((req.headers['x-user-email'] as string) || '').trim().toLowerCase() || null;
    if (!userId) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
      });
      return;
    }
    const access = await partnerService.getPartnerAccess(userId, email);
    res.status(200).json({
      user: { id: userId, email },
      customer_segment: access.customer_segment,
      partner: access.partner,
      has_b2b_access: access.has_access,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/logout
 * Body: { refresh_token: string }
 * Response: { success: boolean }
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = validateRefreshToken(req.body.refresh_token);
    await authService.revokeRefreshToken(token);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as authRoutes };
