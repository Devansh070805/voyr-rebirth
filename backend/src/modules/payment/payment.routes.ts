/**
 * Payment Routes — Express router for payment endpoints.
 *
 * POST /payment/session   — Create a payment session (checkout URL)
 * POST /webhook/payment   — Process payment provider webhook
 * GET  /payment/:id       — Get a payment by ID
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireIdempotencyKey, requireString } from '../../infra/index.js';
import { createDefaultPaymentService } from './payment.factory.js';
import { processPaymentWebhookRequest } from './payment.webhook-handler.js';

const router = Router();
const paymentService = createDefaultPaymentService();

/**
 * POST /payment/session
 * Body: { quote_id: string }
 * Headers: Idempotency-Key or X-Idempotency-Key
 */
router.post('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote_id = requireString(req.body.quote_id, 'quote_id');
    const idempotencyKey = requireIdempotencyKey(req.headers);

    const result = await paymentService.createSession({ quote_id }, idempotencyKey);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /webhook/payment
 * Headers: x-signature (HMAC signature from payment provider)
 *          x-idempotency-key or idempotency-key
 * Body: PaymentWebhookPayload
 */
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await processPaymentWebhookRequest(req, paymentService);
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payment/mock/complete
 * Body: { payment_id: string, status?: 'paid' | 'failed' }
 * Only when PAYMENT_MODE=mock — simulates provider webhook.
 */
router.post('/mock/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment_id = requireString(req.body.payment_id, 'payment_id');
    const status = req.body.status === 'failed' ? 'failed' : 'paid';
    await paymentService.completeMockPayment(payment_id, status);
    res.status(200).json({ ok: true, payment_id, status });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /payment/:id
 * Returns the payment record.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paymentId = requireString(req.params.id, 'id');
    const payment = await paymentService.getPayment(paymentId);
    res.status(200).json(payment);
  } catch (err) {
    next(err);
  }
});

export { router as paymentRoutes };
