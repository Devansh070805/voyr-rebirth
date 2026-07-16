/**
 * Quote Routes — Express router for quote endpoints.
 *
 * POST /quote/generate  — Generate an immutable quote for a package
 * GET  /quote/:id       — Get a quote by ID (also checks expiry)
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createQuoteService } from './quote.service.js';
import { requireString } from '../../infra/index.js';

const router = Router();
const quoteService = createQuoteService();

/**
 * POST /quote/generate
 * Body: { package_id: string }
 */
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const package_id = requireString(req.body.package_id, 'package_id');

    const result = await quoteService.generateQuote({ package_id });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /quote/:id
 * Returns the quote. Also checks and updates expiry status.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quoteId = requireString(req.params.id, 'id');

    // Check expiry first (may transition status to EXPIRED)
    await quoteService.checkExpiry(quoteId);

    // Return the (possibly updated) quote — checkExpiry already validated existence
    // so getQuote will not 404 unless there's a concurrent delete
    const quote = await quoteService.getQuote(quoteId);
    res.status(200).json(quote);
  } catch (err) {
    next(err);
  }
});

export { router as quoteRoutes };
