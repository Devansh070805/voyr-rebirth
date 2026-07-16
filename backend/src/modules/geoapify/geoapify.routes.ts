import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createGeoapifyService } from './geoapify.service.js';
import { ValidationError } from '../../infra/error-handler.js';
import { requireNumber } from '../../infra/index.js';

const router = Router();
const geoapifyService = createGeoapifyService();

router.get('/places/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const text = req.query.text as string | undefined;
    const categories = req.query.categories as string | undefined;
    const filter = req.query.filter as string | undefined;
    const bias = req.query.bias as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (!text && !categories) {
      throw new ValidationError('Either text or categories query parameter is required');
    }

    const places = await geoapifyService.searchPlaces({ text, categories, filter, bias, limit });
    res.json({ places, count: places.length });
  } catch (err) {
    next(err);
  }
});

router.get('/places/nearby', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat = requireNumber(req.query.lat, 'lat');
    const lon = requireNumber(req.query.lon, 'lon');
    const categories = req.query.categories as string;
    const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (!categories) {
      throw new ValidationError('categories query parameter is required');
    }

    const places = await geoapifyService.getNearbyPlaces({ lat, lon, categories, radius, limit });
    res.json({ places, count: places.length });
  } catch (err) {
    next(err);
  }
});

export { router as geoapifyRoutes };
