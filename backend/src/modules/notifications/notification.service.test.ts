/**
 * Unit tests for the Notification Service.
 *
 * Tests:
 * - Email sending with idempotency (Req 10.1, 10.4)
 * - Retry on failure (Req 10.3)
 * - State transition to CUSTOMER_NOTIFIED (Req 10.2)
 *
 * Strategy: Mock the database layer, infra services, and email client
 * to isolate NotificationService logic. Verify correct SQL calls, idempotency,
 * email delivery, retry behavior, and state machine transitions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';


const {
  mockQuery,
  mockQueryOne,
  mockQueryRows,
  mockIdempotencyStart,
  mockIdempotencyComplete,
  mockIdempotencyFail,
  mockStateMachineTransition,
  mockLogAudit,
  mockWithRetry,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockQueryOne: vi.fn(),
  mockQueryRows: vi.fn(),
  mockIdempotencyStart: vi.fn(),
  mockIdempotencyComplete: vi.fn(),
  mockIdempotencyFail: vi.fn(),
  mockStateMachineTransition: vi.fn(),
  mockLogAudit: vi.fn(),
  mockWithRetry: vi.fn(),
}));


vi.mock('../../db/index.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
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
  withRetry: (...args: unknown[]) => mockWithRetry(...args),
  RETRY_EXTERNAL_API: { maxAttempts: 3, baseDelayMs: 1000 },
  isHttpRetryable: vi.fn(() => true),
}));

vi.mock('../../infra/audit.service.js', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

import { createNotificationService } from './notification.service.js';
import type { NotificationService, EmailClient, EmailOptions } from './notification.service.js';


const TEST_BOOKING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEST_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEST_IDEMPOTENCY_KEY = 'idem-notif-key-123';
const TEST_USER_EMAIL = 'traveler@example.com';


function createMockEmailClient(overrides: Partial<EmailClient> = {}): EmailClient {
  return {
    send: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

function mockBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BOOKING_ID,
    status: 'DOCUMENTS_GENERATED',
    quote_id: 'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq',
    ...overrides,
  };
}

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    ...overrides,
  };
}

function mockDocuments() {
  return [
    { id: 'doc-1', type: 'invoice', file_url: 'https://r2.example.com/invoice.pdf', status: 'GENERATED' },
    { id: 'doc-2', type: 'itinerary', file_url: 'https://r2.example.com/itinerary.pdf', status: 'GENERATED' },
    { id: 'doc-3', type: 'voucher', file_url: 'https://r2.example.com/voucher.pdf', status: 'GENERATED' },
  ];
}

/**
 * Default withRetry mock: executes the function once and returns a success result.
 * This simulates the retry utility succeeding on the first attempt.
 */
function setupWithRetrySuccess() {
  mockWithRetry.mockImplementation(async (fn: () => Promise<unknown>) => {
    const result = await fn();
    return { success: true, result, attempts: 1 };
  });
}

/**
 * withRetry mock that simulates failure after all retries exhausted.
 */
function setupWithRetryFailure(error: Error) {
  mockWithRetry.mockResolvedValue({
    success: false,
    error,
    attempts: 3,
  });
}


describe('Notification Service — Unit Tests', () => {
  let service: NotificationService;
  let mockEmail: EmailClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmail = createMockEmailClient();
    setupWithRetrySuccess();
    service = createNotificationService(mockEmail);
  });


  describe('sendBookingDocuments — email sending with idempotency', () => {
    it('should send booking documents email for a valid booking in DOCUMENTS_GENERATED state', async () => {
      // Idempotency: new operation
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });

      // Booking lookup
      mockQueryOne.mockResolvedValueOnce(mockBooking());

      // User lookup
      mockQueryOne.mockResolvedValueOnce(mockUser());

      // Documents lookup
      mockQueryRows.mockResolvedValueOnce(mockDocuments());

      // State machine transition
      mockStateMachineTransition.mockResolvedValueOnce('CUSTOMER_NOTIFIED');

      // Idempotency complete
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);

      // Audit log
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY);

      // Verify idempotency was started with correct parameters
      expect(mockIdempotencyStart).toHaveBeenCalledWith(
        TEST_IDEMPOTENCY_KEY,
        'notification.send_booking_documents',
        JSON.stringify({ bookingId: TEST_BOOKING_ID, userId: TEST_USER_ID }),
      );

      // Verify booking was looked up
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [TEST_BOOKING_ID],
      );

      // Verify user was looked up
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [TEST_USER_ID],
      );

      // Verify documents were fetched
      expect(mockQueryRows).toHaveBeenCalledWith(
        expect.stringContaining('documents'),
        [TEST_BOOKING_ID],
      );

      // Verify email was sent via withRetry
      expect(mockWithRetry).toHaveBeenCalledTimes(1);
      const retryCall = mockWithRetry.mock.calls[0];
      // The first argument is the function to retry
      expect(typeof retryCall[0]).toBe('function');

      // Verify idempotency was completed
      expect(mockIdempotencyComplete).toHaveBeenCalledWith(
        TEST_IDEMPOTENCY_KEY,
        expect.objectContaining({
          bookingId: TEST_BOOKING_ID,
          userId: TEST_USER_ID,
          email: TEST_USER_EMAIL,
          documentsCount: 3,
        }),
      );

      // Verify audit log
      expect(mockLogAudit).toHaveBeenCalledWith(
        'system',
        'notification.documents_sent',
        'booking',
        TEST_BOOKING_ID,
        expect.objectContaining({
          user_id: TEST_USER_ID,
          email: TEST_USER_EMAIL,
        }),
      );
    });

    it('should return without re-processing for a duplicate request with same idempotency key', async () => {
      // Idempotency: already completed
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: true });

      await service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY);

      // Should NOT have queried the database for the booking
      expect(mockQueryOne).not.toHaveBeenCalled();
      // Should NOT have fetched documents
      expect(mockQueryRows).not.toHaveBeenCalled();
      // Should NOT have sent email
      expect(mockWithRetry).not.toHaveBeenCalled();
      // Should NOT have transitioned state
      expect(mockStateMachineTransition).not.toHaveBeenCalled();
    });

    it('should reject when booking is not found', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(null); // booking not found

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow(/not found/i);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
      expect(mockWithRetry).not.toHaveBeenCalled();
    });

    it('should reject when booking is not in DOCUMENTS_GENERATED state', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking({ status: 'BOOKING_CONFIRMED' }));

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow(/expected DOCUMENTS_GENERATED/i);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
      expect(mockWithRetry).not.toHaveBeenCalled();
    });

    it('should reject when user is not found', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(null); // user not found

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow(/not found/i);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
    });

    it('should reject when no generated documents exist for the booking', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockResolvedValueOnce([]); // no documents

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow(/No generated documents/i);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
    });

    it('should return 409 Conflict when an operation is already in progress', async () => {
      const { ConflictError } = await import('../../infra/index.js');
      mockIdempotencyStart.mockRejectedValueOnce(
        new ConflictError(
          `Operation "notification.send_booking_documents" with key "${TEST_IDEMPOTENCY_KEY}" is already in progress`,
        ),
      );

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow(/already in progress/i);
    });

    it('should fail idempotency on unexpected errors', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockRejectedValueOnce(new Error('Database connection lost'));

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow(/Database connection lost/);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
    });

    it('should include document links in the email content', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockResolvedValueOnce(mockDocuments());
      mockStateMachineTransition.mockResolvedValueOnce('CUSTOMER_NOTIFIED');
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      // Capture the email send call through withRetry
      let capturedEmailOptions: EmailOptions | undefined;
      mockWithRetry.mockImplementationOnce(async (fn: () => Promise<unknown>) => {
        // Intercept the email client's send call
        const originalSend = (mockEmail as { send: ReturnType<typeof vi.fn> }).send;
        originalSend.mockImplementationOnce((opts: EmailOptions) => {
          capturedEmailOptions = opts;
          return Promise.resolve({ success: true });
        });
        const result = await fn();
        return { success: true, result, attempts: 1 };
      });

      await service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY);

      expect(capturedEmailOptions).toBeDefined();
      expect(capturedEmailOptions!.to).toBe(TEST_USER_EMAIL);
      expect(capturedEmailOptions!.subject).toContain('Documents');
      expect(capturedEmailOptions!.html).toContain('invoice');
      expect(capturedEmailOptions!.html).toContain('itinerary');
      expect(capturedEmailOptions!.html).toContain('voucher');
      expect(capturedEmailOptions!.html).toContain(TEST_BOOKING_ID);
      expect(capturedEmailOptions!.attachments).toHaveLength(3);
    });
  });


  describe('sendBookingDocuments — retry on failure', () => {
    it('should throw when email sending fails after all retry attempts', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockResolvedValueOnce(mockDocuments());

      // Simulate withRetry returning failure after exhausting retries
      setupWithRetryFailure(new Error('Email provider unavailable'));

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow(/Failed to send notification email/i);

      // Verify idempotency was failed
      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);

      // Verify state machine was NOT transitioned
      expect(mockStateMachineTransition).not.toHaveBeenCalled();
    });

    it('should pass retry configuration to withRetry', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockResolvedValueOnce(mockDocuments());
      mockStateMachineTransition.mockResolvedValueOnce('CUSTOMER_NOTIFIED');
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY);

      // Verify withRetry was called with the email send function and retry options
      expect(mockWithRetry).toHaveBeenCalledTimes(1);
      const [, retryOptions] = mockWithRetry.mock.calls[0];
      expect(retryOptions).toBeDefined();
      expect(retryOptions.operationName).toBe('notification-email');
      expect(typeof retryOptions.isRetryable).toBe('function');
      expect(typeof retryOptions.onRetry).toBe('function');
    });

    it('should not complete idempotency when email fails', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockResolvedValueOnce(mockDocuments());

      setupWithRetryFailure(new Error('SMTP timeout'));

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow();

      expect(mockIdempotencyComplete).not.toHaveBeenCalled();
      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
    });
  });


  describe('sendBookingDocuments — state transition to CUSTOMER_NOTIFIED', () => {
    it('should transition booking from DOCUMENTS_GENERATED to CUSTOMER_NOTIFIED on success', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockResolvedValueOnce(mockDocuments());
      mockStateMachineTransition.mockResolvedValueOnce('CUSTOMER_NOTIFIED');
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY);

      expect(mockStateMachineTransition).toHaveBeenCalledWith(
        TEST_BOOKING_ID,
        'DOCUMENTS_GENERATED',
        'CUSTOMER_NOTIFIED',
        'notification_sent',
      );
    });

    it('should fail idempotency when state machine transition fails', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockResolvedValueOnce(mockDocuments());

      // State machine transition fails
      mockStateMachineTransition.mockRejectedValueOnce(
        new Error('Invalid transition: booking already in CUSTOMER_NOTIFIED state'),
      );

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(
        service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY),
      ).rejects.toThrow(/Invalid transition/i);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
      expect(mockIdempotencyComplete).not.toHaveBeenCalled();
    });

    it('should transition state only after email is successfully sent', async () => {
      const callOrder: string[] = [];

      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryOne.mockResolvedValueOnce(mockUser());
      mockQueryRows.mockResolvedValueOnce(mockDocuments());

      mockWithRetry.mockImplementationOnce(async (fn: () => Promise<unknown>) => {
        callOrder.push('email_sent');
        const result = await fn();
        return { success: true, result, attempts: 1 };
      });

      mockStateMachineTransition.mockImplementationOnce(async () => {
        callOrder.push('state_transition');
        return 'CUSTOMER_NOTIFIED';
      });

      mockIdempotencyComplete.mockResolvedValueOnce(undefined);
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.sendBookingDocuments(TEST_BOOKING_ID, TEST_USER_ID, TEST_IDEMPOTENCY_KEY);

      // Email must be sent before state transition
      expect(callOrder).toEqual(['email_sent', 'state_transition']);
    });
  });


  describe('sendEmail — generic email sending', () => {
    it('should send an email with attachments via withRetry', async () => {
      const attachments = [
        'https://r2.example.com/doc1.pdf',
        'https://r2.example.com/doc2.pdf',
      ];

      await service.sendEmail(
        'user@example.com',
        'Test Subject',
        '<p>Test body</p>',
        attachments,
      );

      expect(mockWithRetry).toHaveBeenCalledTimes(1);
      const [sendFn, retryOptions] = mockWithRetry.mock.calls[0];
      expect(typeof sendFn).toBe('function');
      expect(retryOptions.operationName).toBe('send-email');
    });

    it('should throw when email sending fails after all retries', async () => {
      setupWithRetryFailure(new Error('All retries exhausted'));

      await expect(
        service.sendEmail('user@example.com', 'Subject', '<p>Body</p>', []),
      ).rejects.toThrow(/Failed to send email/i);
    });

    it('should send email with empty attachments array', async () => {
      await service.sendEmail('user@example.com', 'Subject', '<p>Body</p>', []);

      expect(mockWithRetry).toHaveBeenCalledTimes(1);
    });
  });
});
