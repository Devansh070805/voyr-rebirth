import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../infra/admin.middleware.js';
import { createCuratedListingsService } from './curated-listings.service.js';
import { LISTING_TYPES } from './curated-listings.types.js';

const router = Router();
const service = createCuratedListingsService();

router.use(requireAdmin);

router.get('/listings/types', (_req: Request, res: Response) => {
  res.json({ types: LISTING_TYPES });
});

router.get('/listings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listings = await service.list({
      listing_type: req.query.type as never,
      destination_slug: req.query.destination as string | undefined,
      is_active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
    });
    res.json({ listings });
  } catch (err) {
    next(err);
  }
});

router.get('/listings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listing = await service.getById(typeof req.params.id === 'string' ? req.params.id : req.params.id[0]);
    res.json({ listing });
  } catch (err) {
    next(err);
  }
});

router.post('/listings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createdBy = (req.headers['x-user-email'] as string) || (req.headers['x-user-id'] as string);
    const listing = await service.create(req.body, createdBy);
    res.status(201).json({ listing });
  } catch (err) {
    next(err);
  }
});

router.put('/listings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listing = await service.update(typeof req.params.id === 'string' ? req.params.id : req.params.id[0], req.body);
    res.json({ listing });
  } catch (err) {
    next(err);
  }
});

router.delete('/listings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.delete(typeof req.params.id === 'string' ? req.params.id : req.params.id[0]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export { router as curatedListingsAdminRoutes };
