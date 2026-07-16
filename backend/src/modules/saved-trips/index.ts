import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { queryRows, queryOne, query } from '../../db/index.js';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;

  try {
    const items = await queryRows(
      'SELECT * FROM saved_trips WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );

    const formatted = items.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.item_type,
      location: item.location,
      price: item.price,
      image: item.image,
      savedAt: item.created_at,
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  const { title, type, location, price, image, conversationId } = req.body;

  try {
    const item = await queryOne(
      `INSERT INTO saved_trips (user_id, conversation_id, item_type, title, location, price, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, conversationId || null, type, title, location, price, image],
    );

    res.status(201).json({
      id: item?.id,
      title: item?.title,
      type: item?.item_type,
      location: item?.location,
      price: item?.price,
      image: item?.image,
      savedAt: item?.created_at,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  const { id } = req.params;

  try {
    await query('DELETE FROM saved_trips WHERE id = $1 AND user_id = $2', [id, userId]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as savedTripsRoutes };
