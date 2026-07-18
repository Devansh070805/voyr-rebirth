/**
 * Unit tests for the Document Service.
 *
 * Tests:
 * - Enqueue with idempotency (Req 9.1, 9.6)
 * - Document generation and R2 upload (Req 9.2, 9.3, 9.4)
 * - Retry logic and dead-letter queue fallback (Req 9.5)
 *
 * Strategy: Mock the database layer, infra services, R2 client, and queue client
 * to isolate DocumentService logic. Verify correct SQL calls, idempotency,
 * document generation, R2 uploads, retry behavior, and DLQ fallback.
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
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockQueryOne: vi.fn(),
  mockQueryRows: vi.fn(),
  mockIdempotencyStart: vi.fn(),
  mockIdempotencyComplete: vi.fn(),
  mockIdempotencyFail: vi.fn(),
  mockStateMachineTransition: vi.fn(),
  mockLogAudit: vi.fn(),
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
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => {
    try {
      const result = await fn();
      return { success: true, result, attempts: 1 };
    } catch (error) {
      return { success: false, error, attempts: 1 };
    }
  }),
  RETRY_QUEUE_CONSUMER: { maxAttempts: 5, baseDelayMs: 1000 },
  isHttpRetryable: vi.fn(() => true),
}));

vi.mock('../../infra/audit.service.js', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

import { createDocumentService } from './document.service.js';
import type { DocumentService, R2Client, QueueClient, QueueMessage } from './document.service.js';


const TEST_BOOKING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEST_QUOTE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEST_JOB_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const TEST_IDEMPOTENCY_KEY = 'idem-doc-key-123';


function createMockR2Client(overrides: Partial<R2Client> = {}): R2Client {
  return {
    put: vi.fn().mockResolvedValue({ url: 'https://r2.example.com/test-doc.pdf' }),
    ...overrides,
  };
}

function createMockQueueClient(overrides: Partial<QueueClient> = {}): QueueClient {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    publishToDeadLetter: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_BOOKING_ID,
    quote_id: TEST_QUOTE_ID,
    status: 'Ticketed/booked',
    ...overrides,
  };
}

function mockQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_QUOTE_ID,
    currency: 'USD',
    base_amount: 1000,
    tax_amount: 100,
    markup_amount: 50,
    fee_amount: 25,
    discount_amount: 75,
    final_amount: 1100,
    ...overrides,
  };
}

function mockBookingItems() {
  return [
    { id: 'item-1', snapshot: { name: 'Luxury Hotel', type: 'hotel', nights: 3 } },
    { id: 'item-2', snapshot: { name: 'City Tour', type: 'activity', duration: '4h' } },
  ];
}


describe('Document Service — Unit Tests', () => {
  let service: DocumentService;
  let mockR2: R2Client;
  let mockQueue: QueueClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockR2 = createMockR2Client();
    mockQueue = createMockQueueClient();
    service = createDocumentService(mockR2, mockQueue);
  });


  describe('enqueueGeneration — enqueue with idempotency', () => {
    it('should enqueue document generation for a valid booking in Ticketed/booked state', async () => {
      // Idempotency: new operation
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });

      // Booking lookup: valid booking in correct state
      mockQueryOne.mockResolvedValueOnce(mockBooking());

      // Insert document_jobs row
      mockQueryOne.mockResolvedValueOnce({ id: TEST_JOB_ID });

      // Idempotency complete
      mockIdempotencyComplete.mockResolvedValueOnce(undefined);

      // Audit log
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.enqueueGeneration(TEST_BOOKING_ID, TEST_IDEMPOTENCY_KEY);

      // Verify idempotency was started
      expect(mockIdempotencyStart).toHaveBeenCalledWith(
        TEST_IDEMPOTENCY_KEY,
        'document.enqueue',
        JSON.stringify({ bookingId: TEST_BOOKING_ID }),
      );

      // Verify document_jobs row was inserted
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO document_jobs'),
        [TEST_BOOKING_ID],
      );

      // Verify queue message was published
      expect(mockQueue.publish).toHaveBeenCalledWith({
        bookingId: TEST_BOOKING_ID,
        jobId: TEST_JOB_ID,
        attempt: 1,
      });

      // Verify idempotency was completed
      expect(mockIdempotencyComplete).toHaveBeenCalledWith(
        TEST_IDEMPOTENCY_KEY,
        { jobId: TEST_JOB_ID, bookingId: TEST_BOOKING_ID },
      );

      // Verify audit log
      expect(mockLogAudit).toHaveBeenCalledWith(
        'system',
        'document.enqueued',
        'document_job',
        TEST_JOB_ID,
        expect.objectContaining({ booking_id: TEST_BOOKING_ID }),
      );
    });

    it('should return without re-processing for a duplicate request with same idempotency key', async () => {
      // Idempotency: already completed
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: true });

      await service.enqueueGeneration(TEST_BOOKING_ID, TEST_IDEMPOTENCY_KEY);

      // Should NOT have queried the database for the booking
      expect(mockQueryOne).not.toHaveBeenCalled();
      // Should NOT have published to queue
      expect(mockQueue.publish).not.toHaveBeenCalled();
    });

    it('should reject enqueue when booking is not found', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });

      // Booking not found
      mockQueryOne.mockResolvedValueOnce(null);

      // Idempotency fail on error
      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(service.enqueueGeneration(TEST_BOOKING_ID, TEST_IDEMPOTENCY_KEY))
        .rejects.toThrow(/not found/i);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
      expect(mockQueue.publish).not.toHaveBeenCalled();
    });

    it('should reject enqueue when booking is not in Ticketed/booked state', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });

      // Booking in wrong state
      mockQueryOne.mockResolvedValueOnce(mockBooking({ status: 'BOOKING_CONFIRMED' }));

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(service.enqueueGeneration(TEST_BOOKING_ID, TEST_IDEMPOTENCY_KEY))
        .rejects.toThrow(/expected Ticketed\/booked/i);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
      expect(mockQueue.publish).not.toHaveBeenCalled();
    });

    it('should return 409 Conflict when an enqueue operation is already in progress', async () => {
      const { ConflictError } = await import('../../infra/index.js');
      mockIdempotencyStart.mockRejectedValueOnce(
        new ConflictError(`Operation "document.enqueue" with key "${TEST_IDEMPOTENCY_KEY}" is already in progress`),
      );

      await expect(service.enqueueGeneration(TEST_BOOKING_ID, TEST_IDEMPOTENCY_KEY))
        .rejects.toThrow(/already in progress/i);
    });

    it('should fail idempotency on unexpected errors', async () => {
      mockIdempotencyStart.mockResolvedValueOnce({ alreadyCompleted: false });

      // Booking lookup succeeds
      mockQueryOne.mockResolvedValueOnce(mockBooking());

      // Insert document_jobs fails
      mockQueryOne.mockRejectedValueOnce(new Error('Database connection lost'));

      mockIdempotencyFail.mockResolvedValueOnce(undefined);

      await expect(service.enqueueGeneration(TEST_BOOKING_ID, TEST_IDEMPOTENCY_KEY))
        .rejects.toThrow(/Database connection lost/);

      expect(mockIdempotencyFail).toHaveBeenCalledWith(TEST_IDEMPOTENCY_KEY);
    });
  });


  describe('generateDocuments — document generation and R2 upload', () => {
    it('should generate invoice, itinerary, and voucher documents and upload to R2', async () => {
      // Booking lookup
      mockQueryOne.mockResolvedValueOnce(mockBooking());

      // Booking items
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());

      // Quote lookup
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      // R2 uploads succeed (3 documents)
      (mockR2.put as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ url: 'https://r2.example.com/invoice.pdf' })
        .mockResolvedValueOnce({ url: 'https://r2.example.com/itinerary.pdf' })
        .mockResolvedValueOnce({ url: 'https://r2.example.com/voucher.pdf' });

      // DB inserts for documents table (3 inserts)
      mockQuery.mockResolvedValue({ rows: [] });

      const results = await service.generateDocuments(TEST_BOOKING_ID);

      expect(results).toHaveLength(3);

      // Verify invoice
      const invoice = results.find((r) => r.type === 'invoice');
      expect(invoice).toBeDefined();
      expect(invoice!.status).toBe('generated');
      expect(invoice!.file_url).toBe('https://r2.example.com/invoice.pdf');

      // Verify itinerary
      const itinerary = results.find((r) => r.type === 'itinerary');
      expect(itinerary).toBeDefined();
      expect(itinerary!.status).toBe('generated');
      expect(itinerary!.file_url).toBe('https://r2.example.com/itinerary.pdf');

      // Verify voucher
      const voucher = results.find((r) => r.type === 'voucher');
      expect(voucher).toBeDefined();
      expect(voucher!.status).toBe('generated');
      expect(voucher!.file_url).toBe('https://r2.example.com/voucher.pdf');

      // Verify R2 was called 3 times
      expect(mockR2.put).toHaveBeenCalledTimes(3);

      // Verify each R2 upload used correct key pattern and content type
      for (const call of (mockR2.put as ReturnType<typeof vi.fn>).mock.calls) {
        expect(call[0]).toMatch(new RegExp(`^bookings/${TEST_BOOKING_ID}/`));
        expect(call[2]).toEqual({ contentType: 'application/pdf' });
      }

      // Verify documents were inserted into the database
      expect(mockQuery).toHaveBeenCalledTimes(3);
      for (const call of mockQuery.mock.calls) {
        expect(call[0]).toContain('INSERT INTO documents');
      }
    });

    it('should return NotFoundError when booking does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.generateDocuments(TEST_BOOKING_ID))
        .rejects.toThrow(/not found/i);
    });

    it('should return NotFoundError when quote does not exist for booking', async () => {
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      mockQueryOne.mockResolvedValueOnce(null); // quote not found

      await expect(service.generateDocuments(TEST_BOOKING_ID))
        .rejects.toThrow(/Quote.*not found/i);
    });

    it('should mark individual documents as failed when R2 upload fails', async () => {
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      // Invoice upload fails, itinerary and voucher succeed
      (mockR2.put as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('R2 upload timeout'))
        .mockResolvedValueOnce({ url: 'https://r2.example.com/itinerary.pdf' })
        .mockResolvedValueOnce({ url: 'https://r2.example.com/voucher.pdf' });

      mockQuery.mockResolvedValue({ rows: [] });

      const results = await service.generateDocuments(TEST_BOOKING_ID);

      expect(results).toHaveLength(3);

      const invoice = results.find((r) => r.type === 'invoice');
      expect(invoice!.status).toBe('failed');
      expect(invoice!.file_url).toBe('');

      const itinerary = results.find((r) => r.type === 'itinerary');
      expect(itinerary!.status).toBe('generated');

      const voucher = results.find((r) => r.type === 'voucher');
      expect(voucher!.status).toBe('generated');
    });

    it('should handle all documents failing gracefully', async () => {
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      // All R2 uploads fail
      (mockR2.put as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('R2 down'))
        .mockRejectedValueOnce(new Error('R2 down'))
        .mockRejectedValueOnce(new Error('R2 down'));

      const results = await service.generateDocuments(TEST_BOOKING_ID);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === 'failed')).toBe(true);
      expect(results.every((r) => r.file_url === '')).toBe(true);

      // No documents should have been inserted into the DB
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should generate documents with correct content from booking and quote data', async () => {
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      // Capture the buffers passed to R2
      const capturedBuffers: Buffer[] = [];
      (mockR2.put as ReturnType<typeof vi.fn>).mockImplementation(
        async (_key: string, body: Buffer) => {
          capturedBuffers.push(body);
          return { url: `https://r2.example.com/${_key}` };
        },
      );

      mockQuery.mockResolvedValue({ rows: [] });

      await service.generateDocuments(TEST_BOOKING_ID);

      expect(capturedBuffers).toHaveLength(3);

      // Verify buffers are valid PDFs (start with %PDF header)
      for (const buf of capturedBuffers) {
        const header = buf.slice(0, 8).toString('utf-8');
        expect(header).toMatch(/^%PDF/);
        expect(buf.length).toBeGreaterThan(100);
      }
    });
  });


  describe('uploadToR2 — R2 upload with retry', () => {
    it('should upload a document buffer to R2 and return the URL', async () => {
      (mockR2.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        url: 'https://r2.example.com/bookings/test/doc.pdf',
      });

      const buffer = Buffer.from('test pdf content');
      const url = await service.uploadToR2(buffer, 'bookings/test/doc.pdf');

      expect(url).toBe('https://r2.example.com/bookings/test/doc.pdf');
      expect(mockR2.put).toHaveBeenCalledWith(
        'bookings/test/doc.pdf',
        buffer,
        { contentType: 'application/pdf' },
      );
    });

    it('should throw when R2 upload fails after retries', async () => {
      (mockR2.put as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('R2 service unavailable'),
      );

      const buffer = Buffer.from('test pdf content');

      await expect(service.uploadToR2(buffer, 'bookings/test/doc.pdf'))
        .rejects.toThrow(/R2/i);
    });
  });


  describe('getDocuments — fetch documents for a booking', () => {
    it('should return all documents for a booking', async () => {
      const docs = [
        { id: 'doc-1', booking_id: TEST_BOOKING_ID, type: 'invoice', file_url: 'https://r2.example.com/invoice.pdf', status: 'GENERATED' },
        { id: 'doc-2', booking_id: TEST_BOOKING_ID, type: 'itinerary', file_url: 'https://r2.example.com/itinerary.pdf', status: 'GENERATED' },
        { id: 'doc-3', booking_id: TEST_BOOKING_ID, type: 'voucher', file_url: 'https://r2.example.com/voucher.pdf', status: 'GENERATED' },
      ];
      mockQueryRows.mockResolvedValueOnce(docs);

      const result = await service.getDocuments(TEST_BOOKING_ID);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('invoice');
      expect(result[1].type).toBe('itinerary');
      expect(result[2].type).toBe('voucher');
      expect(mockQueryRows).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [TEST_BOOKING_ID],
      );
    });

    it('should return empty array when no documents exist', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getDocuments(TEST_BOOKING_ID);

      expect(result).toHaveLength(0);
    });
  });


  describe('processQueueMessage — retry logic and dead-letter queue fallback', () => {
    it('should process a queue message successfully and transition booking to DOCUMENTS_GENERATED', async () => {
      const message: QueueMessage = {
        bookingId: TEST_BOOKING_ID,
        jobId: TEST_JOB_ID,
        attempt: 1,
      };

      // Update job status to PROCESSING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // generateDocuments internals:
      // Booking lookup
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      // Booking items
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      // Quote lookup
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      // R2 uploads succeed
      (mockR2.put as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ url: 'https://r2.example.com/invoice.pdf' })
        .mockResolvedValueOnce({ url: 'https://r2.example.com/itinerary.pdf' })
        .mockResolvedValueOnce({ url: 'https://r2.example.com/voucher.pdf' });

      // DB inserts for documents table
      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // invoice insert
        .mockResolvedValueOnce({ rows: [] })  // itinerary insert
        .mockResolvedValueOnce({ rows: [] }); // voucher insert

      // Update job status to COMPLETED
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // State machine transition: (Removed in the new 8-state model)

      // Audit log
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.processQueueMessage(message);



      // Verify audit log was recorded
      expect(mockLogAudit).toHaveBeenCalledWith(
        'system',
        'document.generation_complete',
        'booking',
        TEST_BOOKING_ID,
        expect.objectContaining({ job_id: TEST_JOB_ID }),
      );
    });

    it('should retry when document generation partially fails and retries remain', async () => {
      const message: QueueMessage = {
        bookingId: TEST_BOOKING_ID,
        jobId: TEST_JOB_ID,
        attempt: 2, // not at max retries yet
      };

      // Update job status to PROCESSING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // generateDocuments internals:
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      // Invoice fails, others succeed
      (mockR2.put as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('R2 timeout'))
        .mockResolvedValueOnce({ url: 'https://r2.example.com/itinerary.pdf' })
        .mockResolvedValueOnce({ url: 'https://r2.example.com/voucher.pdf' });

      // DB inserts for successful documents
      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // itinerary insert
        .mockResolvedValueOnce({ rows: [] }); // voucher insert

      // Update job status to RETRY_PENDING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.processQueueMessage(message);

      // Verify job was set to RETRY_PENDING (not FAILED)
      const retryStatusCall = mockQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('RETRY_PENDING'),
      );
      expect(retryStatusCall).toBeDefined();

      // Verify a retry message was published to the queue
      expect(mockQueue.publish).toHaveBeenCalledWith({
        bookingId: TEST_BOOKING_ID,
        jobId: TEST_JOB_ID,
        attempt: 3, // incremented
      });

      // Verify booking was NOT transitioned to FAILED
      expect(mockStateMachineTransition).not.toHaveBeenCalled();

      // Verify message was NOT sent to dead-letter queue
      expect(mockQueue.publishToDeadLetter).not.toHaveBeenCalled();
    });

    it('should move to dead-letter queue and transition to FAILED when max retries exceeded', async () => {
      const message: QueueMessage = {
        bookingId: TEST_BOOKING_ID,
        jobId: TEST_JOB_ID,
        attempt: 5, // at max retries
      };

      // Update job status to PROCESSING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // generateDocuments internals:
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      // All R2 uploads fail
      (mockR2.put as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('R2 down'))
        .mockRejectedValueOnce(new Error('R2 down'))
        .mockRejectedValueOnce(new Error('R2 down'));

      // Update job status to FAILED
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // State machine transition: (Removed in the new 8-state model)

      // Audit log
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.processQueueMessage(message);

      // Verify job was set to FAILED
      const failedStatusCall = mockQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes("'FAILED'"),
      );
      expect(failedStatusCall).toBeDefined();

      // Verify message was published to dead-letter queue
      expect(mockQueue.publishToDeadLetter).toHaveBeenCalledWith(
        message,
        expect.stringContaining('failed'),
      );



      // Verify audit log recorded the failure
      expect(mockLogAudit).toHaveBeenCalledWith(
        'system',
        'document.generation_failed',
        'booking',
        TEST_BOOKING_ID,
        expect.objectContaining({
          job_id: TEST_JOB_ID,
          attempts: 5,
        }),
      );

      // Verify no retry was published
      expect(mockQueue.publish).not.toHaveBeenCalled();
    });

    it('should handle state machine transition failure gracefully during DLQ fallback', async () => {
      const message: QueueMessage = {
        bookingId: TEST_BOOKING_ID,
        jobId: TEST_JOB_ID,
        attempt: 5,
      };

      // Update job status to PROCESSING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // generateDocuments fails entirely (booking not found)
      mockQueryOne.mockResolvedValueOnce(null);

      // Update job status to FAILED
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // State machine transition fails
      mockStateMachineTransition.mockRejectedValueOnce(
        new Error('Invalid transition: booking already in FAILED state'),
      );

      // Audit log
      mockLogAudit.mockResolvedValueOnce(undefined);

      // Should NOT throw — the state machine failure is caught and logged
      await service.processQueueMessage(message);

      // Verify DLQ was still called
      expect(mockQueue.publishToDeadLetter).toHaveBeenCalled();
    });

    it('should increment attempt number on retry', async () => {
      const message: QueueMessage = {
        bookingId: TEST_BOOKING_ID,
        jobId: TEST_JOB_ID,
        attempt: 1,
      };

      // Update job status to PROCESSING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // generateDocuments fails
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      // All uploads fail
      (mockR2.put as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'));

      // Update job status to RETRY_PENDING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.processQueueMessage(message);

      // Verify retry message has attempt = 2
      expect(mockQueue.publish).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 2 }),
      );
    });

    it('should not retry or DLQ when all documents generate successfully', async () => {
      const message: QueueMessage = {
        bookingId: TEST_BOOKING_ID,
        jobId: TEST_JOB_ID,
        attempt: 1,
      };

      // Update job status to PROCESSING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // generateDocuments succeeds
      mockQueryOne.mockResolvedValueOnce(mockBooking());
      mockQueryRows.mockResolvedValueOnce(mockBookingItems());
      mockQueryOne.mockResolvedValueOnce(mockQuote());

      (mockR2.put as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ url: 'https://r2.example.com/invoice.pdf' })
        .mockResolvedValueOnce({ url: 'https://r2.example.com/itinerary.pdf' })
        .mockResolvedValueOnce({ url: 'https://r2.example.com/voucher.pdf' });

      // DB inserts for documents
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Update job status to COMPLETED
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // State machine transition
      mockStateMachineTransition.mockResolvedValueOnce('DOCUMENTS_GENERATED');

      // Audit log
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.processQueueMessage(message);

      // No retry or DLQ
      expect(mockQueue.publish).not.toHaveBeenCalled();
      expect(mockQueue.publishToDeadLetter).not.toHaveBeenCalled();
    });
  });
});
