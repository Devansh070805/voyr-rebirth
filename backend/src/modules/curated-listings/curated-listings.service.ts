import { queryRows, queryOne } from '../../db/index.js';
import { NotFoundError, ValidationError } from '../../infra/index.js';
import {
  LISTING_TYPES,
  normalizeDestinationSlug,
  type CreateCuratedListingDto,
  type CuratedListing,
  type CuratedListingFilters,
  type CuratedListingSnapshot,
  type ListingType,
  type UpdateCuratedListingDto,
} from './curated-listings.types.js';

function mapRow(row: Record<string, unknown>): CuratedListing {
  return {
    id: row.id as string,
    listing_type: row.listing_type as ListingType,
    title: row.title as string,
    description: (row.description as string) ?? null,
    destination_slug: row.destination_slug as string,
    country: (row.country as string) ?? null,
    city: (row.city as string) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    cost_price: Number(row.cost_price),
    sell_price: Number(row.sell_price),
    currency: row.currency as string,
    priority: Number(row.priority),
    is_active: row.is_active as boolean,
    valid_from: (row.valid_from as string) ?? null,
    valid_to: (row.valid_to as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    inventory_option_id: (row.inventory_option_id as string) ?? null,
    fulfillment_mode: row.fulfillment_mode as CuratedListing['fulfillment_mode'],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function validateListingType(type: string): ListingType {
  if (!LISTING_TYPES.includes(type as ListingType)) {
    throw new ValidationError(`Invalid listing_type: ${type}`);
  }
  return type as ListingType;
}

export function createCuratedListingsService() {
  return {
    async list(filters: CuratedListingFilters = {}): Promise<CuratedListing[]> {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (filters.listing_type) {
        params.push(filters.listing_type);
        conditions.push(`listing_type = $${params.length}`);
      }
      if (filters.destination_slug) {
        params.push(normalizeDestinationSlug(filters.destination_slug));
        conditions.push(`destination_slug = $${params.length}`);
      }
      if (filters.is_active !== undefined) {
        params.push(filters.is_active);
        conditions.push(`is_active = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await queryRows<Record<string, unknown>>(
        `SELECT * FROM curated_listings ${where} ORDER BY priority DESC, updated_at DESC LIMIT 200`,
        params,
      );
      return rows.map(mapRow);
    },

    async listForDestination(
      destinationSlug: string,
      listingType?: ListingType,
    ): Promise<CuratedListing[]> {
      const slug = normalizeDestinationSlug(destinationSlug);
      const conditions = [
        'destination_slug = $1',
        'is_active = true',
        '(valid_from IS NULL OR valid_from <= NOW())',
        '(valid_to IS NULL OR valid_to >= NOW())',
      ];
      const params: unknown[] = [slug];

      if (listingType) {
        params.push(listingType);
        conditions.push(`listing_type = $${params.length}`);
      }

      const rows = await queryRows<Record<string, unknown>>(
        `SELECT * FROM curated_listings WHERE ${conditions.join(' AND ')} ORDER BY priority DESC, updated_at DESC LIMIT 50`,
        params,
      );
      return rows.map(mapRow);
    },

    async getById(id: string): Promise<CuratedListing> {
      const row = await queryOne<Record<string, unknown>>(
        `SELECT * FROM curated_listings WHERE id = $1`,
        [id],
      );
      if (!row) throw new NotFoundError('Curated listing not found');
      return mapRow(row);
    },

    async create(dto: CreateCuratedListingDto, createdBy?: string): Promise<CuratedListing> {
      validateListingType(dto.listing_type);
      const row = await queryOne<Record<string, unknown>>(
        `INSERT INTO curated_listings (
          listing_type, title, description, destination_slug, country, city,
          payload, cost_price, sell_price, currency, priority, is_active,
          valid_from, valid_to, created_by, inventory_option_id, fulfillment_mode, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING *`,
        [
          dto.listing_type,
          dto.title,
          dto.description ?? null,
          normalizeDestinationSlug(dto.destination_slug),
          dto.country ?? null,
          dto.city ?? null,
          JSON.stringify(dto.payload ?? {}),
          dto.cost_price,
          dto.sell_price,
          dto.currency ?? 'USD',
          dto.priority ?? 0,
          dto.is_active ?? true,
          dto.valid_from ?? null,
          dto.valid_to ?? null,
          createdBy ?? null,
          dto.inventory_option_id ?? null,
          dto.fulfillment_mode ?? 'manual',
          JSON.stringify(dto.metadata ?? {}),
        ],
      );
      return mapRow(row!);
    },

    async update(id: string, dto: UpdateCuratedListingDto): Promise<CuratedListing> {
      const existing = await this.getById(id);
      if (dto.listing_type) validateListingType(dto.listing_type);

      const row = await queryOne<Record<string, unknown>>(
        `UPDATE curated_listings SET
          listing_type = $1, title = $2, description = $3, destination_slug = $4,
          country = $5, city = $6, payload = $7, cost_price = $8, sell_price = $9,
          currency = $10, priority = $11, is_active = $12, valid_from = $13, valid_to = $14,
          inventory_option_id = $15, fulfillment_mode = $16, metadata = $17, updated_at = NOW()
        WHERE id = $18 RETURNING *`,
        [
          dto.listing_type ?? existing.listing_type,
          dto.title ?? existing.title,
          dto.description !== undefined ? dto.description : existing.description,
          dto.destination_slug ? normalizeDestinationSlug(dto.destination_slug) : existing.destination_slug,
          dto.country !== undefined ? dto.country : existing.country,
          dto.city !== undefined ? dto.city : existing.city,
          JSON.stringify(dto.payload ?? existing.payload),
          dto.cost_price ?? existing.cost_price,
          dto.sell_price ?? existing.sell_price,
          dto.currency ?? existing.currency,
          dto.priority ?? existing.priority,
          dto.is_active ?? existing.is_active,
          dto.valid_from !== undefined ? dto.valid_from : existing.valid_from,
          dto.valid_to !== undefined ? dto.valid_to : existing.valid_to,
          dto.inventory_option_id !== undefined ? dto.inventory_option_id : existing.inventory_option_id,
          dto.fulfillment_mode ?? existing.fulfillment_mode,
          JSON.stringify(dto.metadata ?? existing.metadata),
          id,
        ],
      );
      return mapRow(row!);
    },

    async delete(id: string): Promise<void> {
      const row = await queryOne<{ id: string }>(
        `DELETE FROM curated_listings WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!row) throw new NotFoundError('Curated listing not found');
    },

    toSnapshot(listing: CuratedListing): CuratedListingSnapshot {
      return {
        listing_id: listing.id,
        listing_type: listing.listing_type,
        title: listing.title,
        description: listing.description ?? '',
        destination_slug: listing.destination_slug,
        cost_price: listing.cost_price,
        sell_price: listing.sell_price,
        currency: listing.currency,
        source: 'curated',
        featured: true,
        supply_source: 'curated',
        payload: listing.payload,
        badges: ['Voyr Pick', ...(Array.isArray(listing.metadata.badges) ? (listing.metadata.badges as string[]) : [])],
      };
    },
  };
}

export type CuratedListingsService = ReturnType<typeof createCuratedListingsService>;
