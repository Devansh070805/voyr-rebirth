import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createAviationStackService } from './aviation-stack.service.js';

const router = Router();
const aviationStackService = createAviationStackService();

router.get('/flights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flightDate = req.query.flight_date as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const result = await aviationStackService.getFlights(flightDate, limit, offset);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/flights/airports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const result = await aviationStackService.getAirports(limit, offset);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/flights/airlines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const result = await aviationStackService.getAirlines(limit, offset);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/flights/routes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const arrivalIata = req.query.arr_iata as string | undefined;
    const departureIata = req.query.dep_iata as string | undefined;
    const result = await aviationStackService.getRoutes({ limit, offset, arrivalIata, departureIata });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as aviationStackRoutes };
