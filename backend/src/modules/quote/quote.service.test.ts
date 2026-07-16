/**
 * Unit tests for the Quote Service.
 *
 * Tests:
 * - Quote generation with a valid package (Req 5.1, 5.2, 5.3)
 * - Validation error for empty package (Req 5.4)
 * - Expiry transition (Req 5.5)
 * - Immutability enforcement — no update methods exist (Req 5.6)
 *
 * Strategy: Mock the database layer and audit service to isolate the
 * QuoteService logic. Verify correct SQL calls, pricing calculations,
 * state transitions, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQuoteService } from './quote.service.js';
import type { Quote } from './quote.service.js';


const mockQueryRows = vi.fn();
const mockQueryOne = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../../db/index.js', () => ({
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (fn: unknown) => mockTransaction(fn),
}));

const mockLogAudit = vi.fn();
vi.mock('../../infra/audit.service.js', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

vi.mock('../../infra/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  ValidationError: class ValidationError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ValidationError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'NotFoundError';
    }
  },
}));


function createMockClient() {
  return {
    query: vi.fn(),
  };
}

function samplePackageItems() {
  return [
    {
      option_id: '11111111-1111-1111-1111-111111111111',
      quantity: 2,
      selected_date: '2025-06-15',
      option_name: 'Deluxe Room',
      service_name: 'Beach Resort',
      service_type: 'hotel',
      supplier_name: 'Tropical Hotels',
      price: 5000,
      currency: 'INR',
      capacity: 2,
      metadata: { view: 'ocean' },
    },
    {
      option_id: '22222222-2222-2222-2222-222222222222',
      quantity: 1,
      selected_date: '2025-06-16',
      option_name: 'Snorkeling Tour',
      service_name: 'Water Adventures',
      service_type: 'activity',
      supplier_name: 'Island Tours',
      price: 3000,
      currency: 'INR',
      capacity: 10,
      metadata: {},
    },
  ];
}


describe('Quote Service — Unit Tests', () => {
  let service: ReturnType<typeof createQuoteService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createQuoteService();
  });


  describe('generateQuote', () => {
    it('should generate a quote with correct pricing for a valid package', async () => {
      const packageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const quoteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const items = samplePackageItems();

      // Mock: package exists
      mockQueryOne.mockResolvedValueOnce({ id: packageId, status: 'DRAFT' });

      // Mock: package items with pricing
      mockQueryRows.mockResolvedValueOnce(items);

      // Mock: transaction executes the callback
      const mockClient = createMockClient();
      mockClient.query
        // INSERT quote RETURNING id
        .mockResolvedValueOnce({ rows: [{ id: quoteId }] })
        // INSERT quote_items (item 1)
        .mockResolvedValueOnce({ rows: [] })
        // INSERT quote_items (item 2)
        .mockResolvedValueOnce({ rows: [] })
        // INSERT quote_events
        .mockResolvedValueOnce({ rows: [] })
        // UPDATE packages status
        .mockResolvedValueOnce({ rows: [] });

      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
        return fn(mockClient);
      });

      // Mock: logAudit
      mockLogAudit.mockResolvedValueOnce(undefined);

      const result = await service.generateQuote({ package_id: packageId });

      // Verify result structure
      expect(result.quote_id).toBe(quoteId);
      expect(result.valid_until).toBeDefined();
      expect(new Date(result.valid_until).getTime()).toBeGreaterThan(Date.now());

      // Verify pricing calculation:
      // base = (5000 * 2) + (3000 * 1) = 13000
      // tax = 13000 * 0.18 = 2340
      // markup = 13000 * 0.10 = 1300
      // fee = 500
      // discount = 0
      // final = 13000 + 2340 + 1300 + 500 - 0 = 17140
      expect(result.final_amount).toBe(17140);

      // Verify transaction was called
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // Verify quote INSERT was called with correct amounts
      const quoteInsertCall = mockClient.query.mock.calls[0];
      expect(quoteInsertCall[1]).toContain(packageId); // package_id
      expect(quoteInsertCall[1]).toContain('INR'); // currency
      expect(quoteInsertCall[1]).toContain(13000); // base_amount
      expect(quoteInsertCall[1]).toContain(2340); // tax_amount
      expect(quoteInsertCall[1]).toContain(1300); // markup_amount
      expect(quoteInsertCall[1]).toContain(500); // fee_amount
      expect(quoteInsertCall[1]).toContain(0); // discount_amount
      expect(quoteInsertCall[1]).toContain(17140); // final_amount

      // Verify quote_items were inserted with JSONB snapshots (Req 5.2)
      expect(mockClient.query).toHaveBeenCalledTimes(5); // quote + 2 items + event + package update
      const item1Snapshot = JSON.parse(mockClient.query.mock.calls[1][1][1]);
      expect(item1Snapshot.option_name).toBe('Deluxe Room');
      expect(item1Snapshot.price).toBe(5000);
      expect(item1Snapshot.quantity).toBe(2);

      const item2Snapshot = JSON.parse(mockClient.query.mock.calls[2][1][1]);
      expect(item2Snapshot.option_name).toBe('Snorkeling Tour');
      expect(item2Snapshot.price).toBe(3000);

      // Verify quote event was recorded (Req 5.3)
      const eventInsertCall = mockClient.query.mock.calls[3];
      expect(eventInsertCall[1][0]).toBe(quoteId);
      expect(eventInsertCall[1][1]).toBe('QUOTE_CREATED');

      // Verify audit log was called
      expect(mockLogAudit).toHaveBeenCalledWith(
        'system',
        'quote.generated',
        'quote',
        quoteId,
        expect.objectContaining({ package_id: packageId, final_amount: 17140 }),
      );
    });

    it('should set valid_until to 48 hours from now', async () => {
      const packageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const quoteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      mockQueryOne.mockResolvedValueOnce({ id: packageId, status: 'DRAFT' });
      mockQueryRows.mockResolvedValueOnce(samplePackageItems());

      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: quoteId }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));
      mockLogAudit.mockResolvedValueOnce(undefined);

      const before = Date.now();
      const result = await service.generateQuote({ package_id: packageId });
      const after = Date.now();

      const validUntil = new Date(result.valid_until).getTime();
      const expectedMin = before + 48 * 60 * 60 * 1000;
      const expectedMax = after + 48 * 60 * 60 * 1000;

      expect(validUntil).toBeGreaterThanOrEqual(expectedMin);
      expect(validUntil).toBeLessThanOrEqual(expectedMax);
    });

    it('should lock the package status to QUOTED after quote generation', async () => {
      const packageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const quoteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      mockQueryOne.mockResolvedValueOnce({ id: packageId, status: 'DRAFT' });
      mockQueryRows.mockResolvedValueOnce(samplePackageItems());

      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: quoteId }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient));
      mockLogAudit.mockResolvedValueOnce(undefined);

      await service.generateQuote({ package_id: packageId });

      // Last client.query call should be the package status update
      const lastCall = mockClient.query.mock.calls[4];
      expect(lastCall[0]).toContain('UPDATE packages SET status');
      expect(lastCall[1]).toContain(packageId);
    });
  });


  describe('generateQuote — validation errors', () => {
    it('should throw ValidationError when package has no items', async () => {
      const packageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      // Mock: package exists
      mockQueryOne.mockResolvedValueOnce({ id: packageId, status: 'DRAFT' });

      // Mock: no items
      mockQueryRows.mockResolvedValueOnce([]);

      await expect(service.generateQuote({ package_id: packageId }))
        .rejects.toThrow('Cannot generate a quote for a package with no items');
    });

    it('should throw ValidationError with correct error name for empty package', async () => {
      const packageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      mockQueryOne.mockResolvedValueOnce({ id: packageId, status: 'DRAFT' });
      mockQueryRows.mockResolvedValueOnce([]);

      try {
        await service.generateQuote({ package_id: packageId });
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).name).toBe('ValidationError');
      }
    });

    it('should throw NotFoundError when package does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.generateQuote({ package_id: 'nonexistent-id' }))
        .rejects.toThrow('not found');
    });

    it('should not call transaction when package has no items', async () => {
      const packageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      mockQueryOne.mockResolvedValueOnce({ id: packageId, status: 'DRAFT' });
      mockQueryRows.mockResolvedValueOnce([]);

      try {
        await service.generateQuote({ package_id: packageId });
      } catch {
        // expected
      }

      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });


  describe('checkExpiry', () => {
    it('should return true and transition to EXPIRED when valid_until has passed', async () => {
      const quoteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

      // First call: fetch quote
      mockQueryOne
        .mockResolvedValueOnce({ id: quoteId, valid_until: pastDate, status: 'ACTIVE' })
        // Second call: UPDATE to EXPIRED
        .mockResolvedValueOnce({ id: quoteId });

      mockLogAudit.mockResolvedValueOnce(undefined);

      const result = await service.checkExpiry(quoteId);

      expect(result).toBe(true);

      // Verify the UPDATE query was called to transition status
      expect(mockQueryOne).toHaveBeenCalledTimes(2);
      const updateCall = mockQueryOne.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE quotes SET status');
      expect(updateCall[0]).toContain("'EXPIRED'");
      expect(updateCall[1]).toContain(quoteId);

      // Verify audit log was recorded
      expect(mockLogAudit).toHaveBeenCalledWith(
        'system',
        'quote.expired',
        'quote',
        quoteId,
        expect.objectContaining({ valid_until: pastDate }),
      );
    });

    it('should return true immediately when quote is already EXPIRED', async () => {
      const quoteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      mockQueryOne.mockResolvedValueOnce({
        id: quoteId,
        valid_until: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        status: 'EXPIRED',
      });

      const result = await service.checkExpiry(quoteId);

      expect(result).toBe(true);
      // Should not attempt to update — only one queryOne call
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it('should return false when quote is still active and not expired', async () => {
      const quoteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

      mockQueryOne.mockResolvedValueOnce({
        id: quoteId,
        valid_until: futureDate,
        status: 'ACTIVE',
      });

      const result = await service.checkExpiry(quoteId);

      expect(result).toBe(false);
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.checkExpiry('nonexistent-id'))
        .rejects.toThrow('not found');
    });
  });


  describe('immutability enforcement', () => {
    it('should not expose any update method on the QuoteService interface', () => {
      // The QuoteService should only have: generateQuote, getQuote, checkExpiry
      // — no updateQuote, editQuote, or patchQuote
      const serviceKeys = Object.keys(service);

      expect(serviceKeys).toContain('generateQuote');
      expect(serviceKeys).toContain('getQuote');
      expect(serviceKeys).toContain('checkExpiry');

      // Ensure no update/edit/patch methods exist
      expect(serviceKeys).not.toContain('updateQuote');
      expect(serviceKeys).not.toContain('editQuote');
      expect(serviceKeys).not.toContain('patchQuote');
      expect(serviceKeys).not.toContain('modifyQuote');
      expect(serviceKeys).not.toContain('setQuote');
      expect(serviceKeys).not.toContain('serializeQuote');
      expect(serviceKeys).not.toContain('deserializeQuote');
    });

    it('should have exactly 3 methods (no hidden mutation methods)', () => {
      const serviceKeys = Object.keys(service);
      expect(serviceKeys).toHaveLength(3);
    });

    it('getQuote should only perform a SELECT query, never an UPDATE', async () => {
      const quoteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const mockQuote: Quote = {
        id: quoteId,
        package_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        currency: 'INR',
        base_amount: 13000,
        tax_amount: 2340,
        markup_amount: 1300,
        fee_amount: 500,
        discount_amount: 0,
        final_amount: 17140,
        valid_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      };

      mockQueryOne.mockResolvedValueOnce(mockQuote);

      const result = await service.getQuote(quoteId);

      expect(result).toEqual(mockQuote);
      // Verify only a SELECT was issued
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      const query = mockQueryOne.mock.calls[0][0] as string;
      expect(query.toUpperCase()).toContain('SELECT');
      expect(query.toUpperCase()).not.toContain('UPDATE');
      expect(query.toUpperCase()).not.toContain('DELETE');
    });
  });


  describe('getQuote', () => {
    it('should return the quote when it exists', async () => {
      const quoteId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const mockQuote: Quote = {
        id: quoteId,
        package_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        currency: 'INR',
        base_amount: 10000,
        tax_amount: 1800,
        markup_amount: 1000,
        fee_amount: 500,
        discount_amount: 0,
        final_amount: 13300,
        valid_until: '2025-07-01T00:00:00.000Z',
        status: 'ACTIVE',
        created_at: '2025-06-29T00:00:00.000Z',
      };

      mockQueryOne.mockResolvedValueOnce(mockQuote);

      const result = await service.getQuote(quoteId);
      expect(result).toEqual(mockQuote);
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.getQuote('nonexistent-id'))
        .rejects.toThrow('not found');
    });
  });



});
