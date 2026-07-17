/**
 * Unit tests for the Booking Service.
 *
 * Tests:
 * - Booking creation from a paid quote with idempotency
 * - Post-payment auto-confirmation and document enqueue
 * - State machine transitions (Draft → Requested → Confirmed → Ticketed/booked)
 * - Audit logging on all critical operations
 * - Manual booking creation
 *
 * Strategy: Mock the database layer, infra services, and state machine
 * to isolate BookingService logic. Verify correct SQL calls, idempotency,
 * state transitions, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Booking } from './booking.service.js';

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
  mockMetricsRecordBookingEvent,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockQueryOne: vi.fn(),
  mockQueryRows: vi.fn(),
  mockTransaction: vi.fn(),
  mockIdempotencyStart: vi.fn(),
  mockIdempotencyComplete: vi.fn(),
  mockIdempotencyFail: vi.fn(),
  mockStateMachineTransition: vi.fn(),
  mockLogAudit: vi.fn(),
  mockMetricsRecordBookingEvent: vi.fn(),
}));

vi.mock('../../db/index.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
  transaction: (fn: unknown) => mockTransaction(fn),
}));

vi.mock('../../infra/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createIdempotencyService: () => ({
    check: vi.fn(),
    start: (...args: unknown[]) => mockIdempotencyStart(...args),
    complete: (...args: unknown[]) => mockIdempotencyComplete(...args),
    fail: (...args: unknown[]) => mockIdempotencyFail(...args),
  }),
  createStateMachineEngine: () => ({
    transition: (...args: unknown[]) => mockStateMachineTransition(...args),
    validTransitions: vi.fn(),
    isValidTransition: vi.fn(),
  }),
  ValidationError: class ValidationError extends Error {
    public readonly statusCode = 400;
    public readonly code = 'VALIDATION_ERROR';
    constructor(message: string) {
      super(message);
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
  NotFoundError: class NotFoundError extends Error {
    public readonly statusCode = 404;
    public readonly code = 'NOT_FOUND';
    constructor(message = 'Resource not found') {
      super(message);
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
  ConflictError: class ConflictError extends Error {
    public readonly statusCode = 409;
    public readonly code = 'CONFLICT';
    constructor(message = 'Operation already in progress') {
      super(message);
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
  getMetricsService: () => ({
    recordBookingEvent: (...args: unknown[]) => mockMetricsRecordBookingEvent(...args),
    recordPaymentEvent: vi.fn(),
    recordWebhookEvent: vi.fn(),
    recordLatency: vi.fn(),
    getSummary: vi.fn(),
    getPaymentSuccessRate: vi.fn(),
    getBookingSuccessRate: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('../../infra/audit.service.js', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

import { createBookingService } from './booking.service.js';
import type { BookingService } from './booking.service.js';

const TEST_QUOTE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEST_PACKAGE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const TEST_BOOKING_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const TEST_PAYMENT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEST_IDEMPOTENCY_KEY = 'idem-booking-key-123';

function createMockClient() {
  return { query: vi.fn() };
}

function validQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_QUOTE_ID,
    package_id: TEST_PACKAGE_ID,
    status: 'ACTIVE',
    final_amount: 1500,
    currency: 'USD',
    ...overrides,
  };
}

function completedPayment() {
  return { id: TEST_PAYMENT_ID, status: 'PAID' };
}

function existingBooking(overrides: Record<string, unknown> = {}): Booking {
  return {
    id: TEST_BOOKING_ID,
    quote_id: TEST_QUOTE_ID,
    status: 'Draft' as const,
    created_at: new Date().toISOString(),
    ...overrides,
  } as Booking;
}

function quoteItems() {
  return [
    { id: 'item-1', service_snapshot: { name: 'Hotel', price: 500 } as unknown as Record<string, unknown> },
    { id: 'item-2', service_snapshot: { name: 'Tour', price: 300 } as unknown as Record<string, unknown> },
  ];
}

describe('Booking Service — Unit Tests', () => {
  let service: BookingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createBookingService();
  });

  describe('createBooking — booking creation from paid quote with idempotency', () => {
    it('should create a booking from a valid paid quote', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(validQuote());
      mockQueryOne.mockResolvedValueOnce(completedPayment());
      mockQueryOne.mockResolvedValueOnce(null);

      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: TEST_BOOKING_ID }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementationOnce(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));

      mockQueryRows.mockResolvedValueOnce(quoteItems());

      mockQueryOne.mockResolvedValueOnce({ status: 'Confirmed' }); // startDocumentGeneration
      mockStateMachineTransition.mockResolvedValueOnce('Ticketed/booked');
      mockQuery.mockResolvedValueOnce({ rows: [] });

      mockQueryOne.mockResolvedValueOnce(existingBooking({ status: 'Confirmed' }));
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      const result = await service.createBooking(TEST_QUOTE_ID, TEST_IDEMPOTENCY_KEY);

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_BOOKING_ID);
      expect(result.quote_id).toBe(TEST_QUOTE_ID);
      expect(result.status).toBe('Confirmed');

      expect(mockIdempotencyStart).toHaveBeenCalledWith(
        TEST_IDEMPOTENCY_KEY,
        'booking.create',
        expect.any(String),
      );
    });

    it('should return cached booking on duplicate request with same idempotency key', async () => {
      const cachedBooking = existingBooking();
      mockIdempotencyStart.mockResolvedValueOnce({
        alreadyCompleted: true,
        response: cachedBooking,
      });

      const result = await service.createBooking(TEST_QUOTE_ID, TEST_IDEMPOTENCY_KEY);

      expect(result).toEqual(cachedBooking);
      expect(mockQueryOne).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(null);
      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(service.createBooking(TEST_QUOTE_ID, TEST_IDEMPOTENCY_KEY))
        .rejects.toThrow(/not found/i);
    });

    it('should throw ValidationError when payment is not PAID', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(validQuote());
      mockQueryOne.mockResolvedValueOnce({ id: TEST_PAYMENT_ID, status: 'PENDING' });
      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(service.createBooking(TEST_QUOTE_ID, TEST_IDEMPOTENCY_KEY))
        .rejects.toThrow(/does not have a completed payment/i);
    });

    it('should auto-confirm an existing Requested booking', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(validQuote());
      mockQueryOne.mockResolvedValueOnce(completedPayment());
      mockQueryOne.mockResolvedValueOnce(existingBooking({ status: 'Requested' }));

      mockStateMachineTransition.mockResolvedValueOnce('Confirmed');
      mockQueryRows.mockResolvedValueOnce([]);
      mockQueryRows.mockResolvedValueOnce(quoteItems());

      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementationOnce(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));

      mockLogAudit.mockResolvedValueOnce(undefined);
      
      mockQueryOne.mockResolvedValueOnce({ status: 'Confirmed' });
      mockStateMachineTransition.mockResolvedValueOnce('Ticketed/booked');
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQueryOne.mockResolvedValueOnce(existingBooking({ status: 'Confirmed' }));
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);

      const result = await service.createBooking(TEST_QUOTE_ID, TEST_IDEMPOTENCY_KEY);

      expect(result.status).toBe('Confirmed');
      expect(mockStateMachineTransition).toHaveBeenCalledWith(
        TEST_BOOKING_ID,
        'Requested',
        'Confirmed',
        'legacy_settle',
      );
    });
  });

  describe('getBooking — fetch a booking by ID', () => {
    it('should return the booking when it exists', async () => {
      const booking = existingBooking({ status: 'Confirmed' });
      mockQueryOne.mockResolvedValueOnce(booking);

      const result = await service.getBooking(TEST_BOOKING_ID);
      expect(result).toEqual(booking);
    });
  });

  describe('createManualBooking — manual booking creation fallback', () => {
    it('should create a manual booking successfully', async () => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [existingBooking({ account_type: 'AGENT' })] })
        .mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockImplementationOnce(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));

      const result = await service.createManualBooking({
        account_type: 'AGENT',
        status: 'Draft',
      });

      expect(result.account_type).toBe('AGENT');
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.query.mock.calls[0][0]).toContain('INSERT INTO bookings');
    });
  });
});
