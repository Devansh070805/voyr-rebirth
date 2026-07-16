/**
 * Payment provider mode: mock (demo / Tier C without Razorpay) or live (future Razorpay API).
 */
export type PaymentMode = 'mock' | 'live';

export function getPaymentMode(): PaymentMode {
  const raw = (process.env.PAYMENT_MODE || 'mock').trim().toLowerCase();
  return raw === 'live' ? 'live' : 'mock';
}

export function isPaymentMockMode(): boolean {
  return getPaymentMode() === 'mock';
}

export function getMockWebhookSecret(): string {
  return process.env.PAYMENT_MOCK_WEBHOOK_SECRET || 'voyr-mock-webhook-dev';
}
