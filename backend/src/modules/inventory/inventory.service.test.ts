/**
 * Unit tests for the Inventory Service.
 *
 * Tests:
 * - Supplier CRUD (Req 3.1)
 * - Service-option-price chain creation (Req 3.2, 3.3, 3.4)
 * - Availability check (Req 3.5)
 * - Policies (Req 3.6)
 * - Locations (Req 3.7)
 *
 * Strategy: Mock the database layer to isolate InventoryService logic.
 * Verify correct SQL calls, return values, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInventoryService } from './inventory.service.js';
import type { InventoryService } from './inventory.service.js';


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
}));


const SUPPLIER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SERVICE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OPTION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const LOCATION_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const PRICE_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const AVAILABILITY_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const POLICY_ID = '11111111-1111-1111-1111-111111111111';


describe('Inventory Service — Unit Tests', () => {
  let service: InventoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createInventoryService();
  });


  describe('Supplier CRUD', () => {
    it('createSupplier: should insert and return a supplier with id, name, type, metadata', async () => {
      const supplier = {
        id: SUPPLIER_ID,
        name: 'Tropical Hotels',
        type: 'hotel',
        metadata: { region: 'asia' },
      };

      mockQueryOne.mockResolvedValueOnce(supplier);

      const result = await service.createSupplier({
        name: 'Tropical Hotels',
        type: 'hotel',
        metadata: { region: 'asia' },
      });

      expect(result).toEqual(supplier);
      expect(result.id).toBe(SUPPLIER_ID);
      expect(result.name).toBe('Tropical Hotels');
      expect(result.type).toBe('hotel');
      expect(result.metadata).toEqual({ region: 'asia' });

      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO suppliers');
      expect(sql).toContain('RETURNING');
      expect(params).toContain('Tropical Hotels');
      expect(params).toContain('hotel');
    });

    it('getSupplier: should return supplier when found', async () => {
      const supplier = {
        id: SUPPLIER_ID,
        name: 'Tropical Hotels',
        type: 'hotel',
        metadata: {},
      };

      mockQueryOne.mockResolvedValueOnce(supplier);

      const result = await service.getSupplier(SUPPLIER_ID);

      expect(result).toEqual(supplier);
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('suppliers');
      expect(params).toContain(SUPPLIER_ID);
    });

    it('getSupplier: should throw NotFoundError when not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.getSupplier('nonexistent-id'))
        .rejects.toThrow('not found');

      try {
        mockQueryOne.mockResolvedValueOnce(null);
        await service.getSupplier('nonexistent-id');
      } catch (err: unknown) {
        expect((err as Error).name).toBe('NotFoundError');
      }
    });

    it('listSuppliers: should return all suppliers', async () => {
      const suppliers = [
        { id: SUPPLIER_ID, name: 'Tropical Hotels', type: 'hotel', metadata: {} },
        { id: 'other-id', name: 'Island Tours', type: 'activity', metadata: {} },
      ];

      mockQueryRows.mockResolvedValueOnce(suppliers);

      const result = await service.listSuppliers({});

      expect(result).toEqual(suppliers);
      expect(result).toHaveLength(2);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);
      const [sql] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('suppliers');
    });

    it('listSuppliers: should filter by type', async () => {
      const hotelSuppliers = [
        { id: SUPPLIER_ID, name: 'Tropical Hotels', type: 'hotel', metadata: {} },
      ];

      mockQueryRows.mockResolvedValueOnce(hotelSuppliers);

      const result = await service.listSuppliers({ type: 'hotel' });

      expect(result).toEqual(hotelSuppliers);
      expect(result).toHaveLength(1);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('WHERE');
      expect(params).toContain('hotel');
    });
  });


  describe('Service-Option-Price chain', () => {
    it('createService: should insert with supplier_id, location_id, type, name, metadata', async () => {
      const svc = {
        id: SERVICE_ID,
        supplier_id: SUPPLIER_ID,
        location_id: LOCATION_ID,
        type: 'hotel',
        name: 'Beach Resort',
        metadata: { stars: 5 },
      };

      mockQueryOne.mockResolvedValueOnce(svc);

      const result = await service.createService({
        supplier_id: SUPPLIER_ID,
        location_id: LOCATION_ID,
        type: 'hotel',
        name: 'Beach Resort',
        metadata: { stars: 5 },
      });

      expect(result).toEqual(svc);
      expect(result.supplier_id).toBe(SUPPLIER_ID);
      expect(result.location_id).toBe(LOCATION_ID);
      expect(result.type).toBe('hotel');
      expect(result.name).toBe('Beach Resort');

      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO services');
      expect(params).toContain(SUPPLIER_ID);
      expect(params).toContain(LOCATION_ID);
      expect(params).toContain('hotel');
      expect(params).toContain('Beach Resort');
    });

    it('createOption: should insert with service_id, name, capacity, metadata', async () => {
      const option = {
        id: OPTION_ID,
        service_id: SERVICE_ID,
        name: 'Deluxe Room',
        capacity: 2,
        metadata: { view: 'ocean' },
      };

      mockQueryOne.mockResolvedValueOnce(option);

      const result = await service.createOption({
        service_id: SERVICE_ID,
        name: 'Deluxe Room',
        capacity: 2,
        metadata: { view: 'ocean' },
      });

      expect(result).toEqual(option);
      expect(result.service_id).toBe(SERVICE_ID);
      expect(result.name).toBe('Deluxe Room');
      expect(result.capacity).toBe(2);

      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO service_options');
      expect(params).toContain(SERVICE_ID);
      expect(params).toContain('Deluxe Room');
      expect(params).toContain(2);
    });

    it('setPrice: should insert with option_id, price, currency, valid_from, valid_to', async () => {
      const price = {
        id: PRICE_ID,
        option_id: OPTION_ID,
        price: 5000,
        currency: 'INR',
        valid_from: '2025-06-01',
        valid_to: '2025-12-31',
      };

      mockQueryOne.mockResolvedValueOnce(price);

      const result = await service.setPrice({
        option_id: OPTION_ID,
        price: 5000,
        currency: 'INR',
        valid_from: '2025-06-01',
        valid_to: '2025-12-31',
      });

      expect(result).toEqual(price);
      expect(result.option_id).toBe(OPTION_ID);
      expect(result.price).toBe(5000);
      expect(result.currency).toBe('INR');

      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO service_prices');
      expect(params).toContain(OPTION_ID);
      expect(params).toContain(5000);
      expect(params).toContain('INR');
      expect(params).toContain('2025-06-01');
      expect(params).toContain('2025-12-31');
    });

    it('getPrice: should return price for a given option and date within range', async () => {
      const price = {
        id: PRICE_ID,
        option_id: OPTION_ID,
        price: 5000,
        currency: 'INR',
        valid_from: '2025-06-01',
        valid_to: '2025-12-31',
      };

      mockQueryOne.mockResolvedValueOnce(price);

      const result = await service.getPrice(OPTION_ID, new Date('2025-07-15'));

      expect(result).toEqual(price);
      expect(mockQueryOne).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('service_prices');
      expect(sql).toContain('valid_from');
      expect(sql).toContain('valid_to');
      expect(params).toContain(OPTION_ID);
    });

    it('getPrice: should return null when no price matches the date', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await service.getPrice(OPTION_ID, new Date('2024-01-01'));

      expect(result).toBeNull();
    });
  });


  describe('Availability', () => {
    it('setAvailability: should upsert availability record', async () => {
      const availability = {
        id: AVAILABILITY_ID,
        option_id: OPTION_ID,
        date: '2025-07-15',
        available: true,
      };

      mockQueryOne.mockResolvedValueOnce(availability);

      const result = await service.setAvailability({
        option_id: OPTION_ID,
        date: '2025-07-15',
        available: true,
      });

      expect(result).toEqual(availability);
      const [sql] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO service_availability');
      expect(sql).toContain('ON CONFLICT');
    });

    it('checkAvailability: should return true when available', async () => {
      mockQueryOne.mockResolvedValueOnce({ available: true });

      const result = await service.checkAvailability(OPTION_ID, new Date('2025-07-15'));

      expect(result).toBe(true);
      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('service_availability');
      expect(params).toContain(OPTION_ID);
    });

    it('checkAvailability: should return false when not available', async () => {
      mockQueryOne.mockResolvedValueOnce({ available: false });

      const result = await service.checkAvailability(OPTION_ID, new Date('2025-07-15'));

      expect(result).toBe(false);
    });

    it('checkAvailability: should return true (default) when no record exists', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await service.checkAvailability(OPTION_ID, new Date('2025-07-15'));

      expect(result).toBe(true);
    });
  });


  describe('Policies', () => {
    it('setPolicy: should upsert policy for a service', async () => {
      const policy = {
        id: POLICY_ID,
        service_id: SERVICE_ID,
        cancellation_policy: 'Free cancellation up to 24h before',
        refund_rules: 'Full refund if cancelled 24h before check-in',
      };

      mockQueryOne.mockResolvedValueOnce(policy);

      const result = await service.setPolicy({
        service_id: SERVICE_ID,
        cancellation_policy: 'Free cancellation up to 24h before',
        refund_rules: 'Full refund if cancelled 24h before check-in',
      });

      expect(result).toEqual(policy);
      const [sql] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO service_policies');
      expect(sql).toContain('ON CONFLICT');
    });

    it('getPolicy: should return policy when found', async () => {
      const policy = {
        id: POLICY_ID,
        service_id: SERVICE_ID,
        cancellation_policy: 'Free cancellation up to 24h before',
        refund_rules: 'Full refund if cancelled 24h before check-in',
      };

      mockQueryOne.mockResolvedValueOnce(policy);

      const result = await service.getPolicy(SERVICE_ID);

      expect(result).toEqual(policy);
      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('service_policies');
      expect(params).toContain(SERVICE_ID);
    });

    it('getPolicy: should throw NotFoundError when not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.getPolicy('nonexistent-id'))
        .rejects.toThrow('not found');

      try {
        mockQueryOne.mockResolvedValueOnce(null);
        await service.getPolicy('nonexistent-id');
      } catch (err: unknown) {
        expect((err as Error).name).toBe('NotFoundError');
      }
    });
  });


  describe('Locations', () => {
    it('createLocation: should insert and return location with id, city, country, lat, lng', async () => {
      const location = {
        id: LOCATION_ID,
        city: 'Bali',
        country: 'Indonesia',
        lat: -8.3405,
        lng: 115.092,
      };

      mockQueryOne.mockResolvedValueOnce(location);

      const result = await service.createLocation({
        city: 'Bali',
        country: 'Indonesia',
        lat: -8.3405,
        lng: 115.092,
      });

      expect(result).toEqual(location);
      expect(result.id).toBe(LOCATION_ID);
      expect(result.city).toBe('Bali');
      expect(result.country).toBe('Indonesia');
      expect(result.lat).toBe(-8.3405);
      expect(result.lng).toBe(115.092);

      const [sql, params] = mockQueryOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO locations');
      expect(sql).toContain('RETURNING');
      expect(params).toContain('Bali');
      expect(params).toContain('Indonesia');
      expect(params).toContain(-8.3405);
      expect(params).toContain(115.092);
    });

    it('listLocations: should return all locations', async () => {
      const locations = [
        { id: LOCATION_ID, city: 'Bali', country: 'Indonesia', lat: -8.34, lng: 115.09 },
        { id: 'other-id', city: 'Dubai', country: 'UAE', lat: 25.2, lng: 55.27 },
      ];

      mockQueryRows.mockResolvedValueOnce(locations);

      const result = await service.listLocations({});

      expect(result).toEqual(locations);
      expect(result).toHaveLength(2);
      expect(mockQueryRows).toHaveBeenCalledTimes(1);
    });

    it('listLocations: should filter by country', async () => {
      const indonesianLocations = [
        { id: LOCATION_ID, city: 'Bali', country: 'Indonesia', lat: -8.34, lng: 115.09 },
      ];

      mockQueryRows.mockResolvedValueOnce(indonesianLocations);

      const result = await service.listLocations({ country: 'Indonesia' });

      expect(result).toEqual(indonesianLocations);
      expect(result).toHaveLength(1);
      const [sql, params] = mockQueryRows.mock.calls[0];
      expect(sql).toContain('WHERE');
      expect(params).toContain('Indonesia');
    });
  });
});
