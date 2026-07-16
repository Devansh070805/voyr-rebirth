/**
 * Package Service — Draft builder for travel packages.
 *
 * Implements the PackageService interface from the design document.
 * Packages start in DRAFT status and can only be edited while in DRAFT.
 * Once a quote is generated, the package is locked.
 */

import { queryRows, queryOne } from '../../db/index.js';
import { createLogger, NotFoundError, ConflictError } from '../../infra/index.js';

const logger = createLogger('package-service');


export interface Package {
  id: string;
  user_id: string;
  destination: string;
  nights: number;
  people: number;
  status: string;
  created_at: string;
}

export interface PackageItem {
  id: string;
  package_id: string;
  option_id: string;
  quantity: number;
  selected_date: string;
}

export interface CreatePackageRequest {
  destination: string;
  nights: number;
  people: number;
}

export interface CreatePackageResponse {
  package_id: string;
}

export interface AddItemDto {
  option_id: string;
  quantity: number;
  selected_date: string;
  broker_snapshot?: Record<string, unknown>;
}

export interface PackageService {
  createPackage(userId: string, data: CreatePackageRequest): Promise<CreatePackageResponse>;
  addItem(packageId: string, data: AddItemDto): Promise<PackageItem>;
  removeItem(packageId: string, itemId: string): Promise<void>;
  getPackage(packageId: string): Promise<Package>;
  getPackageItems(packageId: string): Promise<PackageItem[]>;
}


async function assertPackageIsDraft(packageId: string): Promise<Package> {
  const pkg = await queryOne<Package>(
    `SELECT id, user_id, destination, nights, people, status, created_at
     FROM packages WHERE id = $1`,
    [packageId],
  );
  if (!pkg) {
    throw new NotFoundError(`Package ${packageId} not found`);
  }
  if (pkg.status !== 'DRAFT') {
    throw new ConflictError(
      `Package ${packageId} is in ${pkg.status} status and cannot be edited. Only DRAFT packages can be modified.`,
    );
  }
  return pkg;
}


export function createPackageService(): PackageService {
  return {
    async createPackage(userId: string, data: CreatePackageRequest): Promise<CreatePackageResponse> {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO packages (user_id, destination, nights, people, status)
         VALUES ($1, $2, $3, $4, 'DRAFT')
         RETURNING id`,
        [userId, data.destination, data.nights, data.people],
      );
      logger.info('Package created', { id: row!.id, user_id: userId });
      return { package_id: row!.id };
    },

    async addItem(packageId: string, data: AddItemDto): Promise<PackageItem> {
      await assertPackageIsDraft(packageId);

      const row = await queryOne<PackageItem>(
        `INSERT INTO package_items (package_id, option_id, quantity, selected_date, broker_snapshot)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, package_id, option_id, quantity, selected_date`,
        [
          packageId,
          data.option_id,
          data.quantity,
          data.selected_date,
          data.broker_snapshot ? JSON.stringify(data.broker_snapshot) : null,
        ],
      );
      logger.info('Package item added', { package_id: packageId, item_id: row!.id });
      return row!;
    },

    async removeItem(packageId: string, itemId: string): Promise<void> {
      await assertPackageIsDraft(packageId);

      const row = await queryOne<{ id: string }>(
        `DELETE FROM package_items WHERE id = $1 AND package_id = $2 RETURNING id`,
        [itemId, packageId],
      );
      if (!row) {
        throw new NotFoundError(`Package item ${itemId} not found in package ${packageId}`);
      }
      logger.info('Package item removed', { package_id: packageId, item_id: itemId });
    },

    async getPackage(packageId: string): Promise<Package> {
      const row = await queryOne<Package>(
        `SELECT id, user_id, destination, nights, people, status, created_at
         FROM packages WHERE id = $1`,
        [packageId],
      );
      if (!row) {
        throw new NotFoundError(`Package ${packageId} not found`);
      }
      return row;
    },

    async getPackageItems(packageId: string): Promise<PackageItem[]> {
      return queryRows<PackageItem>(
        `SELECT id, package_id, option_id, quantity, selected_date
         FROM package_items WHERE package_id = $1
         ORDER BY selected_date`,
        [packageId],
      );
    },
  };
}
