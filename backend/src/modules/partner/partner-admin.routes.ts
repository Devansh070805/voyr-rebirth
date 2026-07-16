import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../infra/admin.middleware.js';
import { ValidationError } from '../../infra/error-handler.js';
import { createPartnerService } from './partner.service.js';

const router = Router();
const partnerService = createPartnerService();

router.use(requireAdmin);

/**
 * GET /admin/partners — list all B2B partners with members.
 */
router.get('/partners', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const partners = await partnerService.listPartners();
    res.json({ partners });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/partners/:id — get a single partner with members.
 */
router.get('/partners/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const partner = await partnerService.getPartner(id);
    res.json({ partner });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/partners — create a new B2B partner organization.
 */
router.post('/partners', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, company_code, contact_email, notes } = req.body;
    if (!name || !company_code) {
      throw new ValidationError('name and company_code are required');
    }
    const partner = await partnerService.createPartner({ name, company_code, contact_email, notes });
    res.status(201).json({ partner });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /admin/partners/:id — update partner details or revoke the entire partner.
 */
router.put('/partners/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const partner = await partnerService.updatePartner(id, req.body);
    res.json({ partner });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /admin/partners/:id — permanently delete a partner and all memberships.
 */
router.delete('/partners/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    await partnerService.deletePartner(id);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/partners/:id/members — grant B2B portal access to an email.
 */
router.post('/partners/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      throw new ValidationError('email is required');
    }
    const member = await partnerService.grantMemberAccess(id, email);
    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /admin/partners/:id/members/:memberId — revoke a member's B2B access.
 */
router.delete('/partners/:id/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const memberId = typeof req.params.memberId === 'string' ? req.params.memberId : req.params.memberId[0];
    const member = await partnerService.revokeMemberAccess(partnerId, memberId);
    res.json({ member });
  } catch (err) {
    next(err);
  }
});

export { router as partnerAdminRoutes };
