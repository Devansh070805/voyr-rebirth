/**
 * Booking Routes — Express router for booking endpoints.
 *
 * GET /booking/:id — Get a booking by ID
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createBookingService } from './booking.service.js';
import { createDocumentService } from '../documents/document.service.js';
import { requireString } from '../../infra/index.js';

const router = Router();
const documentService = createDocumentService();
const bookingService = createBookingService((bookingId, idempotencyKey) =>
  documentService.enqueueGeneration(bookingId, idempotencyKey),
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = requireString(req.params.id, 'id');
    const booking = await bookingService.getBooking(bookingId);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
});

router.post('/manual', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.createManualBooking(req.body);
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

export { router as bookingRoutes };
