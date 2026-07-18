/**
 * Integration Tests — Full Booking Lifecycle
 *
 * Tests the complete booking lifecycle by wiring together the actual service
 * modules with a mocked database layer. Verifies service interactions,
 * state transitions, idempotency, and error flows.
 *
 * Validates: Requirements 6.1, 6.2, 7.1, 7.5, 7.6, 7.7, 8.1, 8.3, 8.4, 9.1, 10.1, 13.5
 *
 * Scenarios:
 * 1. Happy path: package → quote → payment → booking → documents → notification
 * 2. Quote expiry flow
 * 3. Payment failure flow
 * 4. Idempotency across critical operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';


const {
  mockQuery,
  mockQueryOne,
  mockQueryRows,
  mockTransaction,
  mockIdempotencyStart,
  mockIdempotencyComplete,
  mockIdempotencyFail,
  mockStateMachineTransition,
  mockLogAudit,
  mockCreateBooking,
  WEBHOOK_SECRET,
} = vi.hoisted(() => {
  const secret = 'integration-test-webhook-secret';
  process.env.PAYMENT_WEBHOOK_SECRET = secret;
  process.env.NODE_ENV = 'test';

  return {
    mockQuery: vi.fn(),
    mockQueryOne: vi.fn(),
    mockQueryRows: vi.fn(),
    mockTransaction: vi.fn(),
    mockIdempotencyStart: vi.fn(),
    mockIdempotencyComplete: vi.fn(),
    mockIdempotencyFail: vi.fn(),
    mockStateMachineTransition: vi.fn(),
    mockLogAudit: vi.fn(),
    mockCreateBooking: vi.fn(),
    WEBHOOK_SECRET: secret,
  };
});

// Mock paths are relative to the test file location (src/integration/)

vi.mock('../db/index.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
  transaction: (fn: unknown) => mockTransaction(fn),
  pool: { end: vi.fn() },
}));

vi.mock('../infra/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createIdempotencyService: () => ({
    check: vi.fn(),
    start: mockIdempotencyStart,
    complete: mockIdempotencyComplete,
    fail: mockIdempotencyFail,
  }),
  createStateMachineEngine: () => ({
    transition: mockStateMachineTransition,
    validTransitions: vi.fn(),
    isValidTransition: vi.fn(),
  }),
  ValidationError: class ValidationError extends Error {
    public readonly statusCode = 400;
    public readonly code = 'VALIDATION_ERROR';
    constructor(message: string) { super(message); Object.setPrototypeOf(this, new.target.prototype); }
  },
  NotFoundError: class NotFoundError extends Error {
    public readonly statusCode = 404;
    public readonly code = 'NOT_FOUND';
    constructor(message = 'Resource not found') { super(message); Object.setPrototypeOf(this, new.target.prototype); }
  },
  ConflictError: class ConflictError extends Error {
    public readonly statusCode = 409;
    public readonly code = 'CONFLICT';
    constructor(message = 'Conflict') { super(message); Object.setPrototypeOf(this, new.target.prototype); }
  },
  InvalidTransitionError: class InvalidTransitionError extends Error {
    constructor(from: string, to: string) { super(`Invalid transition from ${from} to ${to}`); Object.setPrototypeOf(this, new.target.prototype); }
  },
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => {
    const result = await fn();
    return { success: true, result, attempts: 1 };
  }),
  withRetryOrThrow: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  RETRY_EXTERNAL_API: { maxAttempts: 3, baseDelayMs: 100 },
  RETRY_PAYMENT_PROVIDER: { maxAttempts: 3, baseDelayMs: 500 },
  RETRY_QUEUE_CONSUMER: { maxAttempts: 5, baseDelayMs: 100 },
  isHttpRetryable: vi.fn(() => true),
  getMetricsService: () => ({
    recordPaymentEvent: vi.fn(),
    recordBookingEvent: vi.fn(),
    recordWebhookEvent: vi.fn(),
    recordLatency: vi.fn(),
    getSummary: vi.fn(),
    getPaymentSuccessRate: vi.fn(),
    getBookingSuccessRate: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('../infra/audit.service.js', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...(args as [string, string, string, string, unknown])),
}));

vi.mock('../modules/booking/booking.service.js', () => ({
  createBookingService: () => ({
    createBooking: mockCreateBooking,
    getBooking: vi.fn(),
  }),
}));


import { createPackageService } from '../modules/package/package.service.js';
import { createQuoteService } from '../modules/quote/quote.service.js';
import { createPaymentService } from '../modules/payment/payment.service.js';
import { createDocumentService } from '../modules/documents/document.service.js';
import { createNotificationService } from '../modules/notifications/notification.service.js';


const USER_ID = 'user-0001-0001-0001-000000000001';
const PACKAGE_ID = 'pkg-00001-0001-0001-000000000001';
const OPTION_ID = 'opt-00001-0001-0001-000000000001';
const QUOTE_ID = 'quote-0001-0001-0001-000000000001';
const PAYMENT_ID = 'pay-00001-0001-0001-000000000001';
const BOOKING_ID = 'book-0001-0001-0001-000000000001';
const DOC_JOB_ID = 'docjob-01-0001-0001-000000000001';


function createMockClient() {
  return { query: vi.fn() };
}

function computeSignature(payload: unknown, secret: string): string {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}


describe('Integration — Full Booking Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset one-time mock chains to prevent bleeding between tests
    mockQueryOne.mockReset();
    mockQuery.mockReset();
    mockQueryRows.mockReset();
    mockTransaction.mockReset();
    mockIdempotencyStart.mockReset();
    mockIdempotencyComplete.mockReset();
    mockIdempotencyFail.mockReset();
    mockStateMachineTransition.mockReset();
    mockLogAudit.mockReset();
    mockCreateBooking.mockReset();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 1: Happy Path — Full lifecycle end-to-end
  // Validates: Req 6.1, 6.2, 7.1, 7.5, 8.1, 8.3, 9.1, 10.1
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 1: Happy path — complete booking lifecycle', () => {
    it('should complete: package → quote → payment session → webhook success → booking PENDING', async () => {
      const packageService = createPackageService();
      const quoteService = createQuoteService();
      const paymentService = createPaymentService(mockCreateBooking);

      // ── Step 1: Create Package ──────────────────────────────────────────
      mockQueryOne.mockResolvedValueOnce({ id: PACKAGE_ID });

      const pkg = await packageService.createPackage(USER_ID, {
        destination: 'Bali',
        nights: 5,
        people: 2,
      });
      expect(pkg.package_id).toBe(PACKAGE_ID);

      // ── Step 2: Add Items to Package ────────────────────────────────────
      mockQueryOne.mockResolvedValueOnce({
        id: PACKAGE_ID, user_id: USER_ID, destination: 'Bali',
        nights: 5, people: 2, status: 'DRAFT', created_at: new Date().toISOString(),
      });
      mockQueryOne.mockResolvedValueOnce({
        id: 'item-001', package_id: PACKAGE_ID, option_id: OPTION_ID,
        quantity: 2, selected_date: '2025-03-01',
      });

      const item = await packageService.addItem(PACKAGE_ID, {
        option_id: OPTION_ID, quantity: 2, selected_date: '2025-03-01',
      });
      expect(item.package_id).toBe(PACKAGE_ID);

      // ── Step 3: Generate Quote ──────────────────────────────────────────
      mockQueryOne.mockResolvedValueOnce({ id: PACKAGE_ID, status: 'DRAFT' });
      mockQueryRows.mockResolvedValueOnce([{
        option_id: OPTION_ID, quantity: 2, selected_date: '2025-03-01',
        option_name: 'Deluxe Room', service_name: 'Beach Resort',
        service_type: 'hotel', supplier_name: 'Bali Hotels',
        price: 5000, currency: 'INR', capacity: 4, metadata: {},
      }]);

      const quoteClient = createMockClient();
      quoteClient.query
        .mockResolvedValueOnce({ rows: [{ id: QUOTE_ID }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) => fn(quoteClient));
      mockLogAudit.mockResolvedValueOnce(undefined);

      const quote = await quoteService.generateQuote({ package_id: PACKAGE_ID });
      expect(quote.quote_id).toBe(QUOTE_ID);
      expect(quote.final_amount).toBeGreaterThan(0);

      // ── Step 4: Create Payment Session ──────────────────────────────────
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce({
        id: QUOTE_ID, package_id: PACKAGE_ID, final_amount: quote.final_amount,
        currency: 'INR', valid_until: new Date(Date.now() + 48 * 3600000).toISOString(),
        status: 'ACTIVE',
      });

      const payClient = createMockClient();
      payClient.query.mockResolvedValueOnce({ rows: [{ id: PAYMENT_ID }] });
      mockTransaction.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) => fn(payClient));
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQueryOne.mockResolvedValueOnce(null); // no existing booking

      const bookTrackClient = createMockClient();
      bookTrackClient.query
        .mockResolvedValueOnce({ rows: [{ id: BOOKING_ID }] })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) => fn(bookTrackClient));
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      const session = await paymentService.createSession({ quote_id: QUOTE_ID }, 'idem-pay-1');
      expect(session.checkout_url).toBeDefined();
      expect(session.payment_id).toBe(PAYMENT_ID);

      // ── Step 5: Simulate Webhook Success ────────────────────────────────
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce({
        id: PAYMENT_ID, quote_id: QUOTE_ID, provider: 'razorpay',
        provider_ref: null, amount: quote.final_amount, status: 'PENDING',
        created_at: new Date().toISOString(),
      });

      const webhookClient = createMockClient();
      webhookClient.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) => fn(webhookClient));

      mockQueryOne.mockResolvedValueOnce({ id: BOOKING_ID, status: 'Requested' });
      mockStateMachineTransition.mockResolvedValueOnce('Paid');
      mockCreateBooking.mockResolvedValueOnce({
        id: BOOKING_ID, quote_id: QUOTE_ID,
        status: 'BOOKING_CONFIRMED', created_at: new Date().toISOString(),
      });
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      const webhookPayload = {
        event: 'payment.completed', payment_id: PAYMENT_ID,
        provider_ref: 'razorpay_ref_001', status: 'paid' as const,
        amount: quote.final_amount, currency: 'INR',
      };
      const sig = computeSignature(webhookPayload, WEBHOOK_SECRET);
      await paymentService.processWebhook(sig, webhookPayload, 'idem-wh-1');

      // Verify state machine: Requested → Paid
      expect(mockStateMachineTransition).toHaveBeenCalledWith(
        BOOKING_ID, 'Requested', 'Paid', 'webhook_success',
      );
      // Verify auto-create booking was called
      expect(mockCreateBooking).toHaveBeenCalledWith(
        QUOTE_ID, expect.stringContaining('booking_from_payment'),
      );
    });

    it('should send notification email after documents are generated', async () => {
      const mockEmailClient = { send: vi.fn().mockResolvedValue({ success: true }) };
      const notificationService = createNotificationService(mockEmailClient);

      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce({
        id: BOOKING_ID, status: 'Ticketed/booked', quote_id: QUOTE_ID,
      });
      mockQueryOne.mockResolvedValueOnce({ id: USER_ID, email: 'traveler@example.com' });
      mockQueryRows.mockResolvedValueOnce([
        { id: 'doc-1', type: 'invoice', file_url: 'https://r2.example.com/invoice.pdf', status: 'GENERATED' },
        { id: 'doc-2', type: 'itinerary', file_url: 'https://r2.example.com/itinerary.pdf', status: 'GENERATED' },
        { id: 'doc-3', type: 'voucher', file_url: 'https://r2.example.com/voucher.pdf', status: 'GENERATED' },
      ]);

      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      await notificationService.sendBookingDocuments(BOOKING_ID, USER_ID, 'idem-notify-1');

      expect(mockEmailClient.send).toHaveBeenCalledTimes(1);
      const emailCall = mockEmailClient.send.mock.calls[0][0];
      expect(emailCall.to).toBe('traveler@example.com');
      expect(emailCall.subject).toContain('Documents Are Ready');
    });

    it('should enqueue document generation after booking confirmation', async () => {
      const mockR2 = { put: vi.fn().mockResolvedValue({ url: 'https://r2.example.com/doc.pdf' }) };
      const mockQueue = { publish: vi.fn().mockResolvedValue(undefined), publishToDeadLetter: vi.fn() };
      const documentService = createDocumentService(mockR2, mockQueue);

      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce({ id: BOOKING_ID, status: 'Ticketed/booked' });
      mockQueryOne.mockResolvedValueOnce({ id: DOC_JOB_ID });
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      await documentService.enqueueGeneration(BOOKING_ID, 'idem-doc-1');

      expect(mockQueue.publish).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: BOOKING_ID, jobId: DOC_JOB_ID, attempt: 1 }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 2: Quote Expiry Flow
  // Validates: Req 6.1, 6.2
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 2: Quote expiry flow', () => {
    it('should transition quote to EXPIRED when valid_until has passed', async () => {
      const quoteService = createQuoteService();
      const pastDate = new Date(Date.now() - 3600000).toISOString();

      mockQueryOne.mockResolvedValueOnce({ id: 'exp-q-1', valid_until: pastDate, status: 'ACTIVE' });
      mockQueryOne.mockResolvedValueOnce({ id: 'exp-q-1' }); // UPDATE
      mockLogAudit.mockResolvedValueOnce(undefined);

      const isExpired = await quoteService.checkExpiry('exp-q-1');
      expect(isExpired).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE quotes SET status'),
        ['exp-q-1'],
      );
      expect(mockLogAudit).toHaveBeenCalledWith(
        'system', 'quote.expired', 'quote', 'exp-q-1',
        expect.objectContaining({ valid_until: pastDate }),
      );
    });

    it('should return false for a quote that is still valid', async () => {
      const quoteService = createQuoteService();
      const futureDate = new Date(Date.now() + 48 * 3600000).toISOString();

      mockQueryOne.mockResolvedValueOnce({ id: 'val-q-1', valid_until: futureDate, status: 'ACTIVE' });

      const isExpired = await quoteService.checkExpiry('val-q-1');
      expect(isExpired).toBe(false);
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
    });

    it('should return true immediately for an already-expired quote', async () => {
      const quoteService = createQuoteService();

      mockQueryOne.mockResolvedValueOnce({
        id: 'already-exp', valid_until: new Date(Date.now() - 86400000).toISOString(), status: 'EXPIRED',
      });

      const isExpired = await quoteService.checkExpiry('already-exp');
      expect(isExpired).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 3: Payment Failure Flow
  // Validates: Req 7.6, 7.7
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 3: Payment failure flow', () => {
    it('should transition to PAYMENT_FAILED on webhook failure', async () => {
      const paymentService = createPaymentService();

      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce({
        id: 'fail-pay', quote_id: QUOTE_ID, provider: 'razorpay',
        provider_ref: null, amount: 10000, status: 'PENDING',
        created_at: new Date().toISOString(),
      });

      const failClient = createMockClient();
      failClient.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) => fn(failClient));

      mockQueryOne.mockResolvedValueOnce({ id: 'fail-book', status: 'Requested' });
      mockStateMachineTransition.mockResolvedValueOnce('Failed');
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      const failPayload = {
        event: 'payment.failed', payment_id: 'fail-pay',
        provider_ref: 'razorpay_fail_ref', status: 'failed' as const,
        amount: 10000, currency: 'INR',
      };
      const sig = computeSignature(failPayload, WEBHOOK_SECRET);
      await paymentService.processWebhook(sig, failPayload, 'idem-wh-fail-1');

      // Verify payment updated to FAILED
      expect(failClient.query.mock.calls[0][1]).toContain('FAILED');

      // Verify state machine: Requested → Failed
      expect(mockStateMachineTransition).toHaveBeenCalledWith(
        'fail-book', 'Requested', 'Failed', 'webhook_failure',
      );

      // Verify idempotency completed with FAILED status
      expect(mockIdempotencyComplete).toHaveBeenCalledWith('idem-wh-fail-1', { status: 'FAILED' });

      // Verify auto-create booking was NOT called for failed payments
      expect(mockCreateBooking).not.toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const paymentService = createPaymentService();

      const payload = {
        event: 'payment.completed', payment_id: 'some-pay',
        provider_ref: 'ref', status: 'paid' as const,
      };
      const invalidSig = computeSignature(payload, 'wrong-secret');

      await expect(
        paymentService.processWebhook(invalidSig, payload, 'idem-bad-sig'),
      ).rejects.toThrow(/Invalid webhook signature/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 4: Idempotency Across Critical Operations
  // Validates: Req 13.5
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 4: Idempotency across critical operations', () => {
    it('should return cached response for duplicate payment session creation', async () => {
      const paymentService = createPaymentService();

      // First call: new operation
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce({
        id: QUOTE_ID, package_id: PACKAGE_ID, final_amount: 15000,
        currency: 'INR', valid_until: new Date(Date.now() + 48 * 3600000).toISOString(),
        status: 'ACTIVE',
      });
      const payClient = createMockClient();
      payClient.query.mockResolvedValueOnce({ rows: [{ id: PAYMENT_ID }] });
      mockTransaction.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) => fn(payClient));
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQueryOne.mockResolvedValueOnce(null);
      const bookClient = createMockClient();
      bookClient.query.mockResolvedValueOnce({ rows: [{ id: BOOKING_ID }] }).mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementationOnce(async (fn: (c: unknown) => Promise<unknown>) => fn(bookClient));
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      const firstResult = await paymentService.createSession({ quote_id: QUOTE_ID }, 'idem-dup-1');
      expect(firstResult.payment_id).toBe(PAYMENT_ID);

      // Second call: already completed
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: true, response: firstResult });

      const secondResult = await paymentService.createSession({ quote_id: QUOTE_ID }, 'idem-dup-1');
      expect(secondResult).toEqual(firstResult);
    });

    it('should return without re-processing for duplicate webhook', async () => {
      const paymentService = createPaymentService();

      // Already completed
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: true });

      const payload = {
        event: 'payment.completed', payment_id: PAYMENT_ID,
        provider_ref: 'ref', status: 'paid' as const,
      };
      const sig = computeSignature(payload, WEBHOOK_SECRET);

      await paymentService.processWebhook(sig, payload, 'idem-dup-wh');

      // Should NOT have queried for payment or triggered state machine
      expect(mockQueryOne).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockStateMachineTransition).not.toHaveBeenCalled();
    });

    it('should handle duplicate document generation enqueue via idempotency', async () => {
      const mockR2 = { put: vi.fn().mockResolvedValue({ url: 'https://r2.example.com/doc.pdf' }) };
      const mockQueue = { publish: vi.fn().mockResolvedValue(undefined), publishToDeadLetter: vi.fn() };
      const documentService = createDocumentService(mockR2, mockQueue);

      // First call: new operation
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce({ id: BOOKING_ID, status: 'Ticketed/booked' });
      mockQueryOne.mockResolvedValueOnce({ id: DOC_JOB_ID });
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      await documentService.enqueueGeneration(BOOKING_ID, 'idem-dup-doc');
      expect(mockQueue.publish).toHaveBeenCalledTimes(1);

      // Second call: already completed
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: true });

      await documentService.enqueueGeneration(BOOKING_ID, 'idem-dup-doc');
      // publish should still be 1 (not called again)
      expect(mockQueue.publish).toHaveBeenCalledTimes(1);
    });

    it('should handle duplicate notification sends via idempotency', async () => {
      const mockEmailClient = { send: vi.fn().mockResolvedValue({ success: true }) };
      const notificationService = createNotificationService(mockEmailClient);

      // First call
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce({ id: BOOKING_ID, status: 'Ticketed/booked', quote_id: QUOTE_ID });
      mockQueryOne.mockResolvedValueOnce({ id: USER_ID, email: 'traveler@example.com' });
      mockQueryRows.mockResolvedValueOnce([
        { id: 'doc-1', type: 'invoice', file_url: 'https://r2.example.com/invoice.pdf', status: 'GENERATED' },
      ]);

      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      await notificationService.sendBookingDocuments(BOOKING_ID, USER_ID, 'idem-dup-notify');
      expect(mockEmailClient.send).toHaveBeenCalledTimes(1);

      // Second call: already completed
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: true });

      await notificationService.sendBookingDocuments(BOOKING_ID, USER_ID, 'idem-dup-notify');
      // email should still be 1 (not called again)
      expect(mockEmailClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
