import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createMakcorpsService } from './makcorps.service.js';
import { ValidationError } from '../../infra/error-handler.js';

const router = Router();
const makcorpsService = createMakcorpsService();

router.get('/hotels/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cityid = req.query.cityid as string;
    const checkin = req.query.checkin as string;
    const checkout = req.query.checkout as string;
    const adults = req.query.adults ? parseInt(req.query.adults as string, 10) : undefined;
    const rooms = req.query.rooms ? parseInt(req.query.rooms as string, 10) : undefined;
    const cur = req.query.cur as string | undefined;
    const pagination = req.query.pagination ? parseInt(req.query.pagination as string, 10) : undefined;
    const tax = req.query.tax === 'true' ? true : req.query.tax === 'false' ? false : undefined;
    const children = req.query.children ? parseInt(req.query.children as string, 10) : undefined;

    if (!cityid) throw new ValidationError('cityid query parameter is required');
    if (!checkin) throw new ValidationError('checkin query parameter is required (YYYY-MM-DD)');
    if (!checkout) throw new ValidationError('checkout query parameter is required (YYYY-MM-DD)');
    if (!adults) throw new ValidationError('adults query parameter is required');
    if (!rooms) throw new ValidationError('rooms query parameter is required');

    const result = await makcorpsService.searchHotels({
      cityid, checkin, checkout, adults, rooms, cur, pagination, tax, children,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as makcorpsRoutes };
