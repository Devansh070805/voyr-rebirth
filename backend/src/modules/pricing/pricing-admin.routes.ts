import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../infra/admin.middleware.js';
import { createPricingService } from './pricing.service.js';

const router = Router();
const pricing = createPricingService();

router.use(requireAdmin);

router.get('/pricing/margins', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await pricing.listRules();
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

router.post('/pricing/margins', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await pricing.createRule(req.body);
    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
});

router.put('/pricing/margins/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await pricing.updateRule(typeof req.params.id === 'string' ? req.params.id : req.params.id[0], req.body);
    res.json({ rule });
  } catch (err) {
    next(err);
  }
});

router.delete('/pricing/margins/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pricing.deleteRule(typeof req.params.id === 'string' ? req.params.id : req.params.id[0]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

router.post('/pricing/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { base_price, provider, listing_type, destination_slug, customer_segment } = req.body;
    const result = await pricing.applyMargin({
      provider: provider ?? 'all',
      listingType: listing_type,
      destinationSlug: destination_slug,
      customerSegment: customer_segment ?? 'b2c',
      basePrice: Number(base_price),
    });
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

export { router as pricingAdminRoutes };
