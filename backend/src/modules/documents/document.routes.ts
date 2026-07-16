/**
 * Document Routes — Express router for document endpoints.
 *
 * GET  /documents/:bookingId       — Get all documents for a booking
 * POST /documents/enqueue          — Enqueue document generation for a booking
 * POST /documents/process          — Process a queue message (queue consumer endpoint)
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createDocumentService } from './document.service.js';
import { requireString } from '../../infra/index.js';

const router = Router();
const documentService = createDocumentService();

/**
 * GET /documents/:bookingId
 * Returns all documents for a booking.
 */
router.get('/:bookingId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = requireString(req.params.bookingId, 'bookingId');
    const documents = await documentService.getDocuments(bookingId);
    res.status(200).json(documents);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /documents/enqueue
 * Body: { booking_id: string, idempotency_key: string }
 * Enqueues document generation for a confirmed booking.
 */
router.post('/enqueue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = requireString(req.body.booking_id, 'booking_id');
    const idempotencyKey = requireString(req.body.idempotency_key, 'idempotency_key');

    await documentService.enqueueGeneration(bookingId, idempotencyKey);
    res.status(202).json({ message: 'Document generation enqueued', booking_id: bookingId });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /documents/process
 * Body: { bookingId: string, jobId: string, attempt: number }
 * Queue consumer endpoint — processes a document generation job.
 * In production, this is called by the Cloudflare Queue consumer binding.
 */
router.post('/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = requireString(req.body.bookingId, 'bookingId');
    const jobId = requireString(req.body.jobId, 'jobId');
    const attempt = typeof req.body.attempt === 'number' ? req.body.attempt : 1;

    await documentService.processQueueMessage({ bookingId, jobId, attempt });
    res.status(200).json({ message: 'Document generation processed', bookingId, jobId });
  } catch (err) {
    next(err);
  }
});

export { router as documentRoutes };
