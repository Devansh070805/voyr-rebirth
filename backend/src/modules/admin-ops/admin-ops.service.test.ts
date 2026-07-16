/**
 * Unit tests for the Admin Ops Service.
 *
 * Tests each dashboard query returns correct filtered results:
 * - getActiveBookings (Req 12.1)
 * - getFailedPayments (Req 12.2)
 * - getExpiredQuotes (Req 12.3)
 * - getSupplierPending (Req 12.4)
 * - getDocumentFailures (Req 12.5)
 * - getRefundRequests (Req 12.6)
 *
 * Strategy: Mock the database layer to isolate AdminOpsService logic.
 * Verify correct SQL queries, status filters, and return values.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminOpsService } from './admin-ops.service.js';
import type { AdminOpsService, Booking, Payment, Quote, DocumentJob } from './admin-ops.service.js';


const mockQueryRows = vi.fn();

vi.mock('../../db/index.js', () => ({
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
}));

vi.mock('../../infra/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));


const BOOKING_1: Booking = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  quote_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  status: 'BOOKING_CONFIRMED',
  created_at: '2026-04-01T10:00:00.000Z',
};

const BOOKING_2: Booking = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  quote_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  status: 'BOOKING_CONFIRMED',
  created_at: '2026-04-02T12:00:00.000Z',
};

const SUPPLIER_PENDING_BOOKING: Booking = {
  id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  quote_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  status: 'SUPPLIER_CONFIRMATION_PENDING',
  created_at: '2026-04-03T08:00:00.000Z',
};

const REFUND_BOOKING: Booking = {
  id: '11111111-1111-1111-1111-111111111111',
  quote_id: '22222222-2222-2222-2222-222222222222',
  status: 'REFUND_PENDING',
  created_at: '2026-04-04T14:00:00.000Z',
};

const FAILED_PAYMENT: Payment = {
  id: '33333333-3333-3333-3333-333333333333',
  quote_id: '44444444-4444-4444-4444-444444444444',
  provider: 'razorpay',
  provider_ref: 'pay_abc123',
  amount: 25000,
  status: 'FAILED',
  created_at: '2026-04-01T09:00:00.000Z',
};

const FAILED_PAYMENT_2: Payment = {
  id: '55555555-5555-5555-5555-555555555555',
  quote_id: '66666666-6666-6666-6666-666666666666',
  provider: 'razorpay',
  provider_ref: null,
  amount: 15000,
  status: 'FAILED',
  created_at: '2026-04-02T11:00:00.000Z',
};

const EXPIRED_QUOTE: Quote = {
  id: '77777777-7777-7777-7777-777777777777',
  package_id: '88888888-8888-8888-8888-888888888888',
  currency: 'INR',
  final_amount: 50000,
  valid_until: '2026-03-31T23:59:59.000Z',
  status: 'EXPIRED',
  created_at: '2026-03-28T10:00:00.000Z',
};

const FAILED_DOC_JOB: DocumentJob = {
  id: '99999999-9999-9999-9999-999999999999',
  booking_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  status: 'FAILED',
};

const FAILED_DOC_JOB_2: DocumentJob = {
  id: 'abababab-abab-abab-abab-abababababab',
  booking_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  status: 'FAILED',
};


describe('Admin Ops Service — Unit Tests', () => {
  let service: AdminOpsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createAdminOpsService();
  });


  describe('getActiveBookings', () => {
    it('should query confirmed and document-pipeline bookings', async () => {
      mockQueryRows.mockResolvedValueOnce([BOOKING_1, BOOKING_2]);

      const result = await service.getActiveBookings();

      expect(result).toEqual([BOOKING_1, BOOKING_2]);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('bookings');
      expect(sql).toContain('ANY');
      expect(params[0]).toContain('BOOKING_CONFIRMED');
    });

    it('should return an empty array when no active bookings exist', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getActiveBookings();

      expect(result).toEqual([]);
    });

    it('should order results by created_at descending', async () => {
      mockQueryRows.mockResolvedValueOnce([BOOKING_1, BOOKING_2]);

      await service.getActiveBookings();

      const [sql] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('ORDER BY created_at DESC');
    });
  });


  describe('getFailedPayments', () => {
    it('should query payments with FAILED status', async () => {
      mockQueryRows.mockResolvedValueOnce([FAILED_PAYMENT, FAILED_PAYMENT_2]);

      const result = await service.getFailedPayments();

      expect(result).toEqual([FAILED_PAYMENT, FAILED_PAYMENT_2]);
      expect(result).toHaveLength(2);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('payments');
      expect(sql).toContain('WHERE status = $1');
      expect(params).toEqual(['FAILED']);
    });

    it('should return an empty array when no failed payments exist', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getFailedPayments();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order results by created_at descending', async () => {
      mockQueryRows.mockResolvedValueOnce([FAILED_PAYMENT]);

      await service.getFailedPayments();

      const [sql] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('should return payment fields including provider and amount', async () => {
      mockQueryRows.mockResolvedValueOnce([FAILED_PAYMENT]);

      const result = await service.getFailedPayments();

      expect(result[0].provider).toBe('razorpay');
      expect(result[0].amount).toBe(25000);
      expect(result[0].provider_ref).toBe('pay_abc123');
    });
  });


  describe('getExpiredQuotes', () => {
    it('should query quotes with EXPIRED status', async () => {
      mockQueryRows.mockResolvedValueOnce([EXPIRED_QUOTE]);

      const result = await service.getExpiredQuotes();

      expect(result).toEqual([EXPIRED_QUOTE]);
      expect(result).toHaveLength(1);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('quotes');
      expect(sql).toContain('WHERE status = $1');
      expect(params).toEqual(['EXPIRED']);
    });

    it('should return an empty array when no expired quotes exist', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getExpiredQuotes();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order results by valid_until descending', async () => {
      mockQueryRows.mockResolvedValueOnce([EXPIRED_QUOTE]);

      await service.getExpiredQuotes();

      const [sql] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('ORDER BY valid_until DESC');
    });

    it('should return quote fields including currency and final_amount', async () => {
      mockQueryRows.mockResolvedValueOnce([EXPIRED_QUOTE]);

      const result = await service.getExpiredQuotes();

      expect(result[0].currency).toBe('INR');
      expect(result[0].final_amount).toBe(50000);
      expect(result[0].status).toBe('EXPIRED');
    });
  });


  describe('getSupplierPending', () => {
    it('should query bookings with SUPPLIER_CONFIRMATION_PENDING status', async () => {
      mockQueryRows.mockResolvedValueOnce([SUPPLIER_PENDING_BOOKING]);

      const result = await service.getSupplierPending();

      expect(result).toEqual([SUPPLIER_PENDING_BOOKING]);
      expect(result).toHaveLength(1);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('bookings');
      expect(sql).toContain('WHERE status = $1');
      expect(params).toEqual(['SUPPLIER_CONFIRMATION_PENDING']);
    });

    it('should return an empty array when no supplier-pending bookings exist', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getSupplierPending();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order results by created_at ascending', async () => {
      mockQueryRows.mockResolvedValueOnce([SUPPLIER_PENDING_BOOKING]);

      await service.getSupplierPending();

      const [sql] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('ORDER BY created_at ASC');
    });
  });


  describe('getDocumentFailures', () => {
    it('should query document_jobs with FAILED status', async () => {
      mockQueryRows.mockResolvedValueOnce([FAILED_DOC_JOB, FAILED_DOC_JOB_2]);

      const result = await service.getDocumentFailures();

      expect(result).toEqual([FAILED_DOC_JOB, FAILED_DOC_JOB_2]);
      expect(result).toHaveLength(2);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('document_jobs');
      expect(sql).toContain('WHERE status = $1');
      expect(params).toEqual(['FAILED']);
    });

    it('should return an empty array when no document failures exist', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getDocumentFailures();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order results by booking_id', async () => {
      mockQueryRows.mockResolvedValueOnce([FAILED_DOC_JOB]);

      await service.getDocumentFailures();

      const [sql] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('ORDER BY booking_id');
    });

    it('should return document job fields including booking_id', async () => {
      mockQueryRows.mockResolvedValueOnce([FAILED_DOC_JOB]);

      const result = await service.getDocumentFailures();

      expect(result[0].booking_id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(result[0].status).toBe('FAILED');
    });
  });


  describe('getRefundRequests', () => {
    it('should query bookings with REFUND_PENDING status', async () => {
      mockQueryRows.mockResolvedValueOnce([REFUND_BOOKING]);

      const result = await service.getRefundRequests();

      expect(result).toEqual([REFUND_BOOKING]);
      expect(result).toHaveLength(1);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('bookings');
      expect(sql).toContain('WHERE status = $1');
      expect(params).toEqual(['REFUND_PENDING']);
    });

    it('should return an empty array when no refund requests exist', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getRefundRequests();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order results by created_at ascending', async () => {
      mockQueryRows.mockResolvedValueOnce([REFUND_BOOKING]);

      await service.getRefundRequests();

      const [sql] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('ORDER BY created_at ASC');
    });
  });


  describe('Status filter isolation', () => {
    it('each method queries with its own distinct status value', async () => {
      mockQueryRows.mockResolvedValue([]);

      await service.getActiveBookings();
      await service.getFailedPayments();
      await service.getExpiredQuotes();
      await service.getSupplierPending();
      await service.getDocumentFailures();
      await service.getRefundRequests();

      expect(mockQueryRows).toHaveBeenCalledTimes(6);

      const activeStatuses = mockQueryRows.mock.calls[0][1][0] as string[];
      expect(activeStatuses).toContain('BOOKING_CONFIRMED');
      expect(mockQueryRows.mock.calls[1][1][0]).toBe('FAILED');
      expect(mockQueryRows.mock.calls[2][1][0]).toBe('EXPIRED');
      expect(mockQueryRows.mock.calls[3][1][0]).toBe('SUPPLIER_CONFIRMATION_PENDING');
      expect(mockQueryRows.mock.calls[4][1][0]).toBe('FAILED');
      expect(mockQueryRows.mock.calls[5][1][0]).toBe('REFUND_PENDING');
    });
  });
});
