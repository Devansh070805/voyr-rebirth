import { queryRows, queryOne } from '../../db/index.js';
import { NotFoundError } from '../../infra/index.js';
import type { SupplyLineSnapshot } from '../pricing/pricing.types.js';

export interface BookingFulfillment {
  id: string;
  booking_id: string;
  quote_item_id: string | null;
  supply_source: string;
  supply_product: string;
  curated_listing_id: string | null;
  cost_amount: number;
  sell_amount: number;
  margin_amount: number;
  currency: string;
  margin_rule_id: string | null;
  customer_segment: string;
  provider_search_ref: string | null;
  provider_booking_ref: string | null;
  fulfillment_status: string;
  settlement_status: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mapRow(row: Record<string, unknown>): BookingFulfillment {
  return {
    id: row.id as string,
    booking_id: row.booking_id as string,
    quote_item_id: (row.quote_item_id as string) ?? null,
    supply_source: row.supply_source as string,
    supply_product: row.supply_product as string,
    curated_listing_id: (row.curated_listing_id as string) ?? null,
    cost_amount: Number(row.cost_amount),
    sell_amount: Number(row.sell_amount),
    margin_amount: Number(row.margin_amount),
    currency: row.currency as string,
    margin_rule_id: (row.margin_rule_id as string) ?? null,
    customer_segment: row.customer_segment as string,
    provider_search_ref: (row.provider_search_ref as string) ?? null,
    provider_booking_ref: (row.provider_booking_ref as string) ?? null,
    fulfillment_status: row.fulfillment_status as string,
    settlement_status: row.settlement_status as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function createFulfillmentService() {
  return {
    async createFromLine(
      bookingId: string,
      line: SupplyLineSnapshot & { supply_product: string; quote_item_id?: string },
    ): Promise<BookingFulfillment> {
      const fulfillmentStatus =
        line.supply_source === 'curated' ? 'pending_manual' : 'pending_provider';

      const row = await queryOne<Record<string, unknown>>(
        `INSERT INTO booking_fulfillments (
          booking_id, quote_item_id, supply_source, supply_product, curated_listing_id,
          cost_amount, sell_amount, margin_amount, currency, margin_rule_id, customer_segment,
          provider_search_ref, fulfillment_status, settlement_status, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'unpaid','{}')
        RETURNING *`,
        [
          bookingId,
          line.quote_item_id ?? null,
          line.supply_source,
          line.supply_product,
          line.curated_listing_id ?? null,
          line.cost_amount,
          line.sell_amount,
          line.margin_amount,
          line.currency ?? 'USD',
          line.margin_rule_id,
          line.customer_segment,
          line.provider_search_ref ?? null,
          fulfillmentStatus,
        ],
      );
      return mapRow(row!);
    },

    async createFromQuoteItems(bookingId: string, quoteId: string): Promise<BookingFulfillment[]> {
      const items = await queryRows<{ id: string; service_snapshot: Record<string, unknown> }>(
        `SELECT id, service_snapshot FROM quote_items WHERE quote_id = $1`,
        [quoteId],
      );

      const created: BookingFulfillment[] = [];
      for (const item of items) {
        const snap = item.service_snapshot;
        if (!snap.supply_source) continue;

        const fulfillment = await this.createFromLine(bookingId, {
          supply_source: snap.supply_source as string,
          supply_product: (snap.supply_product as string) || (snap.service_type as string) || 'unknown',
          cost_amount: Number(snap.cost_amount ?? snap.price ?? 0),
          sell_amount: Number(snap.sell_amount ?? snap.price ?? 0),
          margin_amount: Number(snap.margin_amount ?? 0),
          margin_rule_id: (snap.margin_rule_id as string) ?? null,
          customer_segment: (snap.customer_segment as never) ?? 'b2c',
          curated_listing_id: snap.curated_listing_id as string | undefined,
          provider_search_ref: snap.provider_search_ref as string | undefined,
          currency: (snap.currency as string) ?? 'USD',
          quote_item_id: item.id,
        });
        created.push(fulfillment);
      }
      return created;
    },

    async listPending(filters?: { supply_source?: string; fulfillment_status?: string }): Promise<BookingFulfillment[]> {
      const conditions = ["fulfillment_status NOT IN ('confirmed', 'cancelled')"];
      const params: unknown[] = [];
      if (filters?.supply_source) {
        params.push(filters.supply_source);
        conditions.push(`supply_source = $${params.length}`);
      }
      if (filters?.fulfillment_status) {
        params.push(filters.fulfillment_status);
        conditions.push(`fulfillment_status = $${params.length}`);
      }
      const rows = await queryRows<Record<string, unknown>>(
        `SELECT * FROM booking_fulfillments WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`,
        params,
      );
      return rows.map(mapRow);
    },

    async updateStatus(
      id: string,
      updates: { fulfillment_status?: string; settlement_status?: string; provider_booking_ref?: string; payload?: Record<string, unknown> },
    ): Promise<BookingFulfillment> {
      const existing = await queryOne<Record<string, unknown>>(
        `SELECT * FROM booking_fulfillments WHERE id = $1`,
        [id],
      );
      if (!existing) throw new NotFoundError('Fulfillment not found');

      const row = await queryOne<Record<string, unknown>>(
        `UPDATE booking_fulfillments SET
          fulfillment_status = COALESCE($1, fulfillment_status),
          settlement_status = COALESCE($2, settlement_status),
          provider_booking_ref = COALESCE($3, provider_booking_ref),
          payload = COALESCE($4, payload),
          updated_at = NOW()
        WHERE id = $5 RETURNING *`,
        [
          updates.fulfillment_status ?? null,
          updates.settlement_status ?? null,
          updates.provider_booking_ref ?? null,
          updates.payload ? JSON.stringify(updates.payload) : null,
          id,
        ],
      );
      return mapRow(row!);
    },
  };
}

export type FulfillmentService = ReturnType<typeof createFulfillmentService>;
