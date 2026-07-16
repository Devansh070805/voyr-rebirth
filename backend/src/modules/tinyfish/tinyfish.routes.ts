import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createTinyFishService } from './tinyfish.service.js';
import { ValidationError } from '../../infra/error-handler.js';

const router = Router();
const tinyfishService = createTinyFishService();

router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.query as string;
    const location = req.query.location as string | undefined;
    const language = req.query.language as string | undefined;

    if (!query) throw new ValidationError('query query parameter is required');

    const result = await tinyfishService.searchWeb({ query, location, language });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as tinyfishRoutes };
