/**
 * Webhook Routes — Dedicated router for payment provider webhooks.
 *
 * POST /webhook/payment — Process payment provider webhook
 *
 * This is separated from the main payment routes so that mounting
 * at /webhook produces the correct path /webhook/payment, matching
 * the gateway's public endpoint configuration.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createDefaultPaymentService } from './payment.factory.js';
import { processPaymentWebhookRequest } from './payment.webhook-handler.js';

const router = Router();
const paymentService = createDefaultPaymentService();

/**
 * POST /webhook/payment
 * Headers: x-signature (HMAC signature from payment provider)
 *          x-idempotency-key or idempotency-key
 * Body: PaymentWebhookPayload
 */
router.post('/payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await processPaymentWebhookRequest(req, paymentService);
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

export { router as webhookRoutes };
