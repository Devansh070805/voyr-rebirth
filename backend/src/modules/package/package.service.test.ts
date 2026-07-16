/**
 * Unit tests for the Package Service.
 *
 * Tests:
 * - Package creation in DRAFT status (Req 4.1)
 * - Adding items to a draft package (Req 4.2)
 * - Removing items from a draft package (Req 4.3)
 * - Editing allowed while DRAFT (Req 4.4)
 * - Rejection of edits on non-DRAFT packages (Req 4.5)
 *
 * Strategy: Mock the database layer to isolate PackageService logic.
 * Verify correct SQL calls, return values, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPackageService } from './package.service.js';
import type { PackageService } from './package.service.js';


const mockQueryRows = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/index.js', () => ({
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));

vi.mock('../../infra/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'NotFoundError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ConflictError';
    }
  },
}));


const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PACKAGE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OPTION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ITEM_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const DRAFT_PACKAGE = {
  id: PACKAGE_ID,
  user_id: USER_ID,
  destination: 'Bali',
  nights: 5,
  people: 2,
  status: 'DRAFT',
  created_at: '2026-04-01T00:00:00.000Z',
};

const QUOTED_PACKAGE = {
  ...DRAFT_PACKAGE,
  status: 'QUOTED',
};

const SAMPLE_ITEM = {
  id: ITEM_ID,
  package_id: PACKAGE_ID,
  option_id: OPTION_ID,
  quantity: 2,
  selected_date: '2026-06-15',
};


describe('Package Service — Unit Tests', () => {
  let service: PackageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createPackageService();
  });


  describe('createPackage', () => {
    it('should create a package in DRAFT status and return the package_id', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: PACKAGE_ID });

      const result = await service.createPackage(USER_ID, {
        destination: 'Bali',
        nights: 5,
        people: 2,
      });

      expect(result).toEqual({ package_id: PACKAGE_ID });
      expect(mockQueryOne).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO packages');
      expect(sql).toContain('DRAFT');
      expect(sql).toContain('RETURNING');
      expect(params).toContain(USER_ID);
      expect(params).toContain('Bali');
      expect(params).toContain(5);
      expect(params).toContain(2);
    });

    it('should pass destination, nights, and people to the INSERT', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: PACKAGE_ID });

      await service.createPackage(USER_ID, {
        destination: 'Maldives',
        nights: 7,
        people: 4,
      });

      const [, params] = mockQueryOne.mock.calls[0];
      expect(params).toContain('Maldives');
      expect(params).toContain(7);
      expect(params).toContain(4);
    });
  });


  describe('addItem', () => {
    it('should add an item to a DRAFT package and return the created item', async () => {
      // First call: assertPackageIsDraft SELECT
      mockQueryOne.mockResolvedValueOnce(DRAFT_PACKAGE);
      // Second call: INSERT package_items
      mockQueryOne.mockResolvedValueOnce(SAMPLE_ITEM);

      const result = await service.addItem(PACKAGE_ID, {
        option_id: OPTION_ID,
        quantity: 2,
        selected_date: '2026-06-15',
      });

      expect(result).toEqual(SAMPLE_ITEM);
      expect(result.package_id).toBe(PACKAGE_ID);
      expect(result.option_id).toBe(OPTION_ID);
      expect(result.quantity).toBe(2);
      expect(result.selected_date).toBe('2026-06-15');

      // Verify two DB calls: one for draft check, one for insert
      expect(mockQueryOne).toHaveBeenCalledTimes(2);

      const [insertSql, insertParams] = mockQueryOne.mock.calls[1];
      expect(insertSql).toContain('INSERT INTO package_items');
      expect(insertSql).toContain('RETURNING');
      expect(insertParams).toContain(PACKAGE_ID);
      expect(insertParams).toContain(OPTION_ID);
      expect(insertParams).toContain(2);
      expect(insertParams).toContain('2026-06-15');
    });

    it('should check that the package is in DRAFT status before adding', async () => {
      mockQueryOne.mockResolvedValueOnce(DRAFT_PACKAGE);
      mockQueryOne.mockResolvedValueOnce(SAMPLE_ITEM);

      await service.addItem(PACKAGE_ID, {
        option_id: OPTION_ID,
        quantity: 1,
        selected_date: '2026-06-15',
      });

      // First call should be the draft status check
      const [checkSql, checkParams] = mockQueryOne.mock.calls[0];
      expect(checkSql).toContain('SELECT');
      expect(checkSql).toContain('packages');
      expect(checkParams).toContain(PACKAGE_ID);
    });

    it('should reject adding items to a non-DRAFT package with ConflictError', async () => {
      mockQueryOne.mockResolvedValueOnce(QUOTED_PACKAGE);

      await expect(
        service.addItem(PACKAGE_ID, {
          option_id: OPTION_ID,
          quantity: 1,
          selected_date: '2026-06-15',
        }),
      ).rejects.toThrow(/cannot be edited|DRAFT/i);

      try {
        mockQueryOne.mockResolvedValueOnce(QUOTED_PACKAGE);
        await service.addItem(PACKAGE_ID, {
          option_id: OPTION_ID,
          quantity: 1,
          selected_date: '2026-06-15',
        });
      } catch (err: unknown) {
        expect((err as Error).name).toBe('ConflictError');
      }
    });

    it('should throw NotFoundError when package does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        service.addItem('nonexistent-id', {
          option_id: OPTION_ID,
          quantity: 1,
          selected_date: '2026-06-15',
        }),
      ).rejects.toThrow(/not found/i);

      try {
        mockQueryOne.mockResolvedValueOnce(null);
        await service.addItem('nonexistent-id', {
          option_id: OPTION_ID,
          quantity: 1,
          selected_date: '2026-06-15',
        });
      } catch (err: unknown) {
        expect((err as Error).name).toBe('NotFoundError');
      }
    });
  });


  describe('removeItem', () => {
    it('should remove an item from a DRAFT package', async () => {
      // First call: assertPackageIsDraft SELECT
      mockQueryOne.mockResolvedValueOnce(DRAFT_PACKAGE);
      // Second call: DELETE RETURNING
      mockQueryOne.mockResolvedValueOnce({ id: ITEM_ID });

      await service.removeItem(PACKAGE_ID, ITEM_ID);

      expect(mockQueryOne).toHaveBeenCalledTimes(2);

      const [deleteSql, deleteParams] = mockQueryOne.mock.calls[1];
      expect(deleteSql).toContain('DELETE FROM package_items');
      expect(deleteSql).toContain('RETURNING');
      expect(deleteParams).toContain(ITEM_ID);
      expect(deleteParams).toContain(PACKAGE_ID);
    });

    it('should check that the package is in DRAFT status before removing', async () => {
      mockQueryOne.mockResolvedValueOnce(DRAFT_PACKAGE);
      mockQueryOne.mockResolvedValueOnce({ id: ITEM_ID });

      await service.removeItem(PACKAGE_ID, ITEM_ID);

      const [checkSql, checkParams] = mockQueryOne.mock.calls[0];
      expect(checkSql).toContain('SELECT');
      expect(checkSql).toContain('packages');
      expect(checkParams).toContain(PACKAGE_ID);
    });

    it('should reject removing items from a non-DRAFT package with ConflictError', async () => {
      mockQueryOne.mockResolvedValueOnce(QUOTED_PACKAGE);

      await expect(
        service.removeItem(PACKAGE_ID, ITEM_ID),
      ).rejects.toThrow(/cannot be edited|DRAFT/i);

      try {
        mockQueryOne.mockResolvedValueOnce(QUOTED_PACKAGE);
        await service.removeItem(PACKAGE_ID, ITEM_ID);
      } catch (err: unknown) {
        expect((err as Error).name).toBe('ConflictError');
      }
    });

    it('should throw NotFoundError when package does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        service.removeItem('nonexistent-id', ITEM_ID),
      ).rejects.toThrow(/not found/i);

      try {
        mockQueryOne.mockResolvedValueOnce(null);
        await service.removeItem('nonexistent-id', ITEM_ID);
      } catch (err: unknown) {
        expect((err as Error).name).toBe('NotFoundError');
      }
    });

    it('should throw NotFoundError when item does not exist in the package', async () => {
      // Package exists and is DRAFT
      mockQueryOne.mockResolvedValueOnce(DRAFT_PACKAGE);
      // DELETE returns null (no matching row)
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        service.removeItem(PACKAGE_ID, 'nonexistent-item-id'),
      ).rejects.toThrow(/not found/i);

      try {
        mockQueryOne.mockResolvedValueOnce(DRAFT_PACKAGE);
        mockQueryOne.mockResolvedValueOnce(null);
        await service.removeItem(PACKAGE_ID, 'nonexistent-item-id');
      } catch (err: unknown) {
        expect((err as Error).name).toBe('NotFoundError');
      }
    });
  });


  describe('rejection of edits on non-DRAFT packages', () => {
    const NON_DRAFT_STATUSES = ['QUOTED', 'PAYMENT_PENDING', 'BOOKED', 'CANCELLED'];

    for (const status of NON_DRAFT_STATUSES) {
      it(`should reject addItem when package status is ${status}`, async () => {
        mockQueryOne.mockResolvedValueOnce({ ...DRAFT_PACKAGE, status });

        await expect(
          service.addItem(PACKAGE_ID, {
            option_id: OPTION_ID,
            quantity: 1,
            selected_date: '2026-06-15',
          }),
        ).rejects.toThrow(/cannot be edited|DRAFT/i);
      });

      it(`should reject removeItem when package status is ${status}`, async () => {
        mockQueryOne.mockResolvedValueOnce({ ...DRAFT_PACKAGE, status });

        await expect(
          service.removeItem(PACKAGE_ID, ITEM_ID),
        ).rejects.toThrow(/cannot be edited|DRAFT/i);
      });
    }
  });


  describe('getPackage', () => {
    it('should return the package when found', async () => {
      mockQueryOne.mockResolvedValueOnce(DRAFT_PACKAGE);

      const result = await service.getPackage(PACKAGE_ID);

      expect(result).toEqual(DRAFT_PACKAGE);
      expect(mockQueryOne).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('packages');
      expect(params).toContain(PACKAGE_ID);
    });

    it('should throw NotFoundError when package does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.getPackage('nonexistent-id'))
        .rejects.toThrow(/not found/i);

      try {
        mockQueryOne.mockResolvedValueOnce(null);
        await service.getPackage('nonexistent-id');
      } catch (err: unknown) {
        expect((err as Error).name).toBe('NotFoundError');
      }
    });
  });


  describe('getPackageItems', () => {
    it('should return all items for a package ordered by selected_date', async () => {
      const items = [
        { ...SAMPLE_ITEM, selected_date: '2026-06-15' },
        { ...SAMPLE_ITEM, id: 'other-item-id', selected_date: '2026-06-16' },
      ];

      mockQueryRows.mockResolvedValueOnce(items);

      const result = await service.getPackageItems(PACKAGE_ID);

      expect(result).toEqual(items);
      expect(result).toHaveLength(2);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);

      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('package_items');
      expect(sql).toContain('ORDER BY selected_date');
      expect(params).toContain(PACKAGE_ID);
    });

    it('should return an empty array when package has no items', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getPackageItems(PACKAGE_ID);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
