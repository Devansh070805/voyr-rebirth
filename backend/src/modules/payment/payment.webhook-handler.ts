import type { Request } from 'express';
import { ValidationError } from '../../infra/error-handler.js';
import { requireString } from '../../infra/validation.js';
import type { PaymentService } from './payment.service.js';

export async function processPaymentWebhookRequest(
  req: Request,
  paymentService: PaymentService,
): Promise<void> {
  const signature = requireString(req.headers['x-signature'] as string, 'x-signature header');

  const idempotencyKey =
    (req.headers['x-idempotency-key'] as string) ||
    (req.headers['idempotency-key'] as string) ||
    `webhook_${req.body.payment_id}_${req.body.event}`;

  const payload = req.body;

  if (!payload || !payload.payment_id || !payload.status) {
    throw new ValidationError('Webhook payload must include payment_id and status');
  }

  await paymentService.processWebhook(signature, payload, idempotencyKey);
}
