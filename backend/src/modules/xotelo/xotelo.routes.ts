import { Router } from 'express';
import { getHotelDetails } from './xotelo.service.js';
import { createLogger } from '../../infra/index.js';

const router = Router();
const logger = createLogger('xotelo-routes');

router.get('/details/:hotel_key', async (req, res) => {
  try {
    const { hotel_key } = req.params;
    const { checkin, checkout } = req.query as { checkin?: string; checkout?: string };

    const details = await getHotelDetails(hotel_key, checkin, checkout);
    res.json(details);
  } catch (err) {
    logger.error('Failed to get hotel details', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const xoteloRoutes = router;
