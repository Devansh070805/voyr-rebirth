/**
 * Inventory Service — CRUD operations for suppliers, services, options,
 * pricing, availability, policies, and locations.
 *
 * Implements the InventoryService interface from the design document.
 * All queries use parameterized SQL against the inventory tables.
 */

import { queryRows, queryOne } from '../../db/index.js';
import { createLogger, NotFoundError } from '../../infra/index.js';

const logger = createLogger('inventory-service');

function buildWhereClause<T>(
  filters: T,
  columnMap: Record<string, string>,
): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (value !== undefined && value !== null && columnMap[key]) {
      params.push(value);
      conditions.push(`${columnMap[key]} = $${params.length}`);
    }
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}


export interface Supplier {
  id: string;
  name: string;
  type: string;
  metadata: Record<string, unknown>;
}

export interface CreateSupplierDto {
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface SupplierFilters {
  type?: string;
}

export interface Location {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface CreateLocationDto {
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface LocationFilters {
  country?: string;
  city?: string;
}

export interface Service {
  id: string;
  supplier_id: string;
  location_id: string;
  type: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface CreateServiceDto {
  supplier_id: string;
  location_id: string;
  type: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface ServiceFilters {
  supplier_id?: string;
  location_id?: string;
  type?: string;
}

export interface ServiceOption {
  id: string;
  service_id: string;
  name: string;
  capacity: number;
  metadata: Record<string, unknown>;
}

export interface CreateOptionDto {
  service_id: string;
  name: string;
  capacity: number;
  metadata?: Record<string, unknown>;
}

export interface ServicePrice {
  id: string;
  option_id: string;
  price: number;
  currency: string;
  valid_from: string;
  valid_to: string;
}

export interface SetPriceDto {
  option_id: string;
  price: number;
  currency: string;
  valid_from: string;
  valid_to: string;
}

export interface ServiceAvailability {
  id: string;
  option_id: string;
  date: string;
  available: boolean;
}

export interface SetAvailabilityDto {
  option_id: string;
  date: string;
  available: boolean;
}

export interface ServicePolicy {
  id: string;
  service_id: string;
  cancellation_policy: string;
  refund_rules: string;
}

export interface SetPolicyDto {
  service_id: string;
  cancellation_policy: string;
  refund_rules: string;
}

export interface InventoryService {
  // Suppliers
  createSupplier(data: CreateSupplierDto): Promise<Supplier>;
  getSupplier(id: string): Promise<Supplier>;
  listSuppliers(filters: SupplierFilters): Promise<Supplier[]>;

  // Services
  createService(data: CreateServiceDto): Promise<Service>;
  getService(id: string): Promise<Service>;
  listServices(filters: ServiceFilters): Promise<Service[]>;

  // Options
  createOption(data: CreateOptionDto): Promise<ServiceOption>;
  getOption(id: string): Promise<ServiceOption>;
  listOptions(serviceId: string): Promise<ServiceOption[]>;

  // Pricing
  setPrice(data: SetPriceDto): Promise<ServicePrice>;
  getPrice(optionId: string, date: Date): Promise<ServicePrice | null>;

  // Availability
  setAvailability(data: SetAvailabilityDto): Promise<ServiceAvailability>;
  checkAvailability(optionId: string, date: Date): Promise<boolean>;

  // Policies
  setPolicy(data: SetPolicyDto): Promise<ServicePolicy>;
  getPolicy(serviceId: string): Promise<ServicePolicy>;

  // Locations
  createLocation(data: CreateLocationDto): Promise<Location>;
  listLocations(filters: LocationFilters): Promise<Location[]>;
}


export function createInventoryService(): InventoryService {
  return {

    async createSupplier(data: CreateSupplierDto): Promise<Supplier> {
      const row = await queryOne<Supplier>(
        `INSERT INTO suppliers (name, type, metadata)
         VALUES ($1, $2, $3)
         RETURNING id, name, type, metadata`,
        [data.name, data.type, JSON.stringify(data.metadata || {})],
      );
      logger.info('Supplier created', { id: row!.id });
      return row!;
    },

    async getSupplier(id: string): Promise<Supplier> {
      const row = await queryOne<Supplier>(
        `SELECT id, name, type, metadata FROM suppliers WHERE id = $1`,
        [id],
      );
      if (!row) throw new NotFoundError(`Supplier ${id} not found`);
      return row;
    },

    async listSuppliers(filters: SupplierFilters): Promise<Supplier[]> {
      const { where, params } = buildWhereClause(filters, { type: 'type' });
      return queryRows<Supplier>(
        `SELECT id, name, type, metadata FROM suppliers ${where} ORDER BY name`,
        params,
      );
    },


    async createService(data: CreateServiceDto): Promise<Service> {
      const row = await queryOne<Service>(
        `INSERT INTO services (supplier_id, location_id, type, name, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, supplier_id, location_id, type, name, metadata`,
        [data.supplier_id, data.location_id, data.type, data.name, JSON.stringify(data.metadata || {})],
      );
      logger.info('Service created', { id: row!.id });
      return row!;
    },

    async getService(id: string): Promise<Service> {
      const row = await queryOne<Service>(
        `SELECT id, supplier_id, location_id, type, name, metadata FROM services WHERE id = $1`,
        [id],
      );
      if (!row) throw new NotFoundError(`Service ${id} not found`);
      return row;
    },

    async listServices(filters: ServiceFilters): Promise<Service[]> {
      const { where, params } = buildWhereClause(filters, {
        supplier_id: 'supplier_id',
        location_id: 'location_id',
        type: 'type',
      });
      return queryRows<Service>(
        `SELECT id, supplier_id, location_id, type, name, metadata FROM services ${where} ORDER BY name`,
        params,
      );
    },


    async createOption(data: CreateOptionDto): Promise<ServiceOption> {
      const row = await queryOne<ServiceOption>(
        `INSERT INTO service_options (service_id, name, capacity, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING id, service_id, name, capacity, metadata`,
        [data.service_id, data.name, data.capacity, JSON.stringify(data.metadata || {})],
      );
      logger.info('Service option created', { id: row!.id });
      return row!;
    },

    async getOption(id: string): Promise<ServiceOption> {
      const row = await queryOne<ServiceOption>(
        `SELECT id, service_id, name, capacity, metadata FROM service_options WHERE id = $1`,
        [id],
      );
      if (!row) throw new NotFoundError(`Service option ${id} not found`);
      return row;
    },

    async listOptions(serviceId: string): Promise<ServiceOption[]> {
      return queryRows<ServiceOption>(
        `SELECT id, service_id, name, capacity, metadata FROM service_options WHERE service_id = $1 ORDER BY name`,
        [serviceId],
      );
    },


    async setPrice(data: SetPriceDto): Promise<ServicePrice> {
      const row = await queryOne<ServicePrice>(
        `INSERT INTO service_prices (option_id, price, currency, valid_from, valid_to)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, option_id, price, currency, valid_from, valid_to`,
        [data.option_id, data.price, data.currency, data.valid_from, data.valid_to],
      );
      logger.info('Price set', { id: row!.id, option_id: data.option_id });
      return row!;
    },

    async getPrice(optionId: string, date: Date): Promise<ServicePrice | null> {
      return queryOne<ServicePrice>(
        `SELECT id, option_id, price, currency, valid_from, valid_to
         FROM service_prices
         WHERE option_id = $1 AND valid_from <= $2 AND valid_to >= $2
         ORDER BY valid_from DESC
         LIMIT 1`,
        [optionId, date.toISOString().split('T')[0]],
      );
    },


    async setAvailability(data: SetAvailabilityDto): Promise<ServiceAvailability> {
      const row = await queryOne<ServiceAvailability>(
        `INSERT INTO service_availability (option_id, date, available)
         VALUES ($1, $2, $3)
         ON CONFLICT (option_id, date) DO UPDATE SET available = $3
         RETURNING id, option_id, date, available`,
        [data.option_id, data.date, data.available],
      );
      logger.info('Availability set', { option_id: data.option_id, date: data.date });
      return row!;
    },

    async checkAvailability(optionId: string, date: Date): Promise<boolean> {
      const row = await queryOne<{ available: boolean }>(
        `SELECT available FROM service_availability
         WHERE option_id = $1 AND date = $2`,
        [optionId, date.toISOString().split('T')[0]],
      );
      // If no record exists, assume available
      return row?.available ?? true;
    },


    async setPolicy(data: SetPolicyDto): Promise<ServicePolicy> {
      const row = await queryOne<ServicePolicy>(
        `INSERT INTO service_policies (service_id, cancellation_policy, refund_rules)
         VALUES ($1, $2, $3)
         ON CONFLICT (service_id) DO UPDATE SET cancellation_policy = $2, refund_rules = $3
         RETURNING id, service_id, cancellation_policy, refund_rules`,
        [data.service_id, data.cancellation_policy, data.refund_rules],
      );
      logger.info('Policy set', { service_id: data.service_id });
      return row!;
    },

    async getPolicy(serviceId: string): Promise<ServicePolicy> {
      const row = await queryOne<ServicePolicy>(
        `SELECT id, service_id, cancellation_policy, refund_rules
         FROM service_policies WHERE service_id = $1`,
        [serviceId],
      );
      if (!row) throw new NotFoundError(`Policy for service ${serviceId} not found`);
      return row;
    },


    async createLocation(data: CreateLocationDto): Promise<Location> {
      const row = await queryOne<Location>(
        `INSERT INTO locations (city, country, lat, lng)
         VALUES ($1, $2, $3, $4)
         RETURNING id, city, country, lat, lng`,
        [data.city, data.country, data.lat, data.lng],
      );
      logger.info('Location created', { id: row!.id });
      return row!;
    },

    async listLocations(filters: LocationFilters): Promise<Location[]> {
      const { where, params } = buildWhereClause(filters, {
        country: 'country',
        city: 'city',
      });
      return queryRows<Location>(
        `SELECT id, city, country, lat, lng FROM locations ${where} ORDER BY country, city`,
        params,
      );
    },
  };
}
