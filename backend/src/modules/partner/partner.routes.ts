import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createPartnerService } from './partner.service.js';

const router = Router();
const partnerService = createPartnerService();

function getUserContext(req: Request): { userId: string; email: string | null } {
  return {
    userId: (req.headers['x-user-id'] as string) || '',
    email: ((req.headers['x-user-email'] as string) || '').trim().toLowerCase() || null,
  };
}

/**
 * GET /partner/access — whether the current user has active B2B portal access.
 */
router.get('/access', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, email } = getUserContext(req);
    const access = await partnerService.getPartnerAccess(userId, email);
    res.status(200).json(access);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /partner/profile — partner details for the authenticated B2B user.
 */
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, email } = getUserContext(req);
    const access = await partnerService.getPartnerAccess(userId, email);
    if (!access.has_access) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'B2B partner access required', statusCode: 403 },
      });
      return;
    }
    res.status(200).json({
      partner: access.partner,
      customer_segment: access.customer_segment,
    });
  } catch (err) {
    next(err);
  }
});

export { router as partnerRoutes };
