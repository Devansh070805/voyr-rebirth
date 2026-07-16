/**
 * Notification Routes — Express router for notification endpoints.
 *
 * POST /notifications/send-documents  — Send booking documents to user via email
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createNotificationService } from './notification.service.js';
import { requireString } from '../../infra/index.js';

const router = Router();
const notificationService = createNotificationService();

/**
 * POST /notifications/send-documents
 * Body: { booking_id: string, user_id: string, idempotency_key: string }
 * Sends booking documents to the user via email.
 * Triggered when a booking reaches DOCUMENTS_GENERATED state.
 */
router.post('/send-documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = requireString(req.body.booking_id, 'booking_id');
    const userId = requireString(req.body.user_id, 'user_id');
    const idempotencyKey = requireString(req.body.idempotency_key, 'idempotency_key');

    await notificationService.sendBookingDocuments(bookingId, userId, idempotencyKey);

    res.status(200).json({
      message: 'Booking documents notification sent',
      booking_id: bookingId,
      user_id: userId,
    });
  } catch (err) {
    next(err);
  }
});

export { router as notificationRoutes };
