/**
 * Quote Service — Immutable priced snapshots of packages.
 * Quotes cannot be updated after creation; expiry is enforced via valid_until.
 */

import { queryRows, queryOne, transaction } from '../../db/index.js';
import { createLogger, ValidationError, NotFoundError } from '../../infra/index.js';
import { logAudit } from '../../infra/audit.service.js';

const logger = createLogger('quote-service');


export interface Quote {
  id: string;
  package_id: string;
  currency: string;
  base_amount: number;
  tax_amount: number;
  markup_amount: number;
  fee_amount: number;
  discount_amount: number;
  final_amount: number;
  valid_until: string;
  status: 'ACTIVE' | 'EXPIRED';
  created_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  service_snapshot: Record<string, unknown>;
}

export interface GenerateQuoteRequest {
  package_id: string;
}

export interface GenerateQuoteResponse {
  quote_id: string;
  final_amount: number;
  valid_until: string;
}

export interface QuoteService {
  generateQuote(data: GenerateQuoteRequest): Promise<GenerateQuoteResponse>;
  getQuote(quoteId: string): Promise<Quote>;
  checkExpiry(quoteId: string): Promise<boolean>;
}


const TAX_RATE = Number(process.env.QUOTE_TAX_RATE) || 0.18;
const MARKUP_RATE = Number(process.env.QUOTE_MARKUP_RATE) || 0.10;
const FEE_FLAT = Number(process.env.QUOTE_FEE_FLAT) || 500;
const DISCOUNT_RATE = Number(process.env.QUOTE_DISCOUNT_RATE) || 0.0;
const QUOTE_VALIDITY_HOURS = Number(process.env.QUOTE_VALIDITY_HOURS) || 48


interface PackageItemWithPrice {
  option_id: string;
  quantity: number;
  selected_date: string;
  option_name: string;
  service_name: string;
  service_type: string;
  supplier_name: string;
  price: number;
  currency: string;
  capacity: number;
  metadata: Record<string, unknown>;
  broker_snapshot: Record<string, unknown>;
}

/**
 * Fetch package items joined with their service option details and current pricing.
 */
async function getPackageItemsWithPricing(packageId: string): Promise<PackageItemWithPrice[]> {
  return queryRows<PackageItemWithPrice>(
    `SELECT
       pi.option_id,
       pi.quantity,
       pi.selected_date,
       so.name AS option_name,
       s.name AS service_name,
       s.type AS service_type,
       sup.name AS supplier_name,
       COALESCE(sp.price, 0) AS price,
       COALESCE(sp.currency, 'INR') AS currency,
       so.capacity,
       COALESCE(so.metadata, '{}') AS metadata,
       COALESCE(pi.broker_snapshot, '{}') AS broker_snapshot
     FROM package_items pi
     JOIN service_options so ON so.id = pi.option_id
     JOIN services s ON s.id = so.service_id
     JOIN suppliers sup ON sup.id = s.supplier_id
     LEFT JOIN service_prices sp ON sp.option_id = pi.option_id
       AND pi.selected_date BETWEEN sp.valid_from AND sp.valid_to
     WHERE pi.package_id = $1
     ORDER BY pi.selected_date`,
    [packageId],
  );
}

/**
 * Calculate pricing breakdown from package items.
 */
function calculatePricing(items: PackageItemWithPrice[]): {
  base_amount: number;
  tax_amount: number;
  markup_amount: number;
  fee_amount: number;
  discount_amount: number;
  final_amount: number;
  currency: string;
} {
  const base_amount = items.reduce((sum, item) => {
    const meta = { ...item.metadata, ...item.broker_snapshot };
    const sellFromMeta = meta.sell_amount;
    const unitPrice = sellFromMeta != null ? Number(sellFromMeta) : Number(item.price);
    return sum + unitPrice * item.quantity;
  }, 0);
  const tax_amount = Math.round(base_amount * TAX_RATE * 100) / 100;
  const markup_amount = Math.round(base_amount * MARKUP_RATE * 100) / 100;
  const fee_amount = FEE_FLAT;
  const discount_amount = Math.round(base_amount * DISCOUNT_RATE * 100) / 100;
  const final_amount = Math.round((base_amount + tax_amount + markup_amount + fee_amount - discount_amount) * 100) / 100;
  const currency = items[0]?.currency || 'INR';

  return { base_amount, tax_amount, markup_amount, fee_amount, discount_amount, final_amount, currency };
}


export function createQuoteService(): QuoteService {
  return {
    async generateQuote(data: GenerateQuoteRequest): Promise<GenerateQuoteResponse> {
      const { package_id } = data;

      // Validate package exists
      const pkg = await queryOne<{ id: string; status: string }>(
        `SELECT id, status FROM packages WHERE id = $1`,
        [package_id],
      );
      if (!pkg) {
        throw new NotFoundError(`Package ${package_id} not found`);
      }

      // Fetch items with pricing
      const items = await getPackageItemsWithPricing(package_id);
      if (items.length === 0) {
        throw new ValidationError('Cannot generate a quote for a package with no items');
      }

      // Calculate pricing
      const pricing = calculatePricing(items);

      // Calculate valid_until
      const validUntil = new Date(Date.now() + QUOTE_VALIDITY_HOURS * 60 * 60 * 1000);

      // Insert quote, quote_items, and quote_event in a transaction
      const quoteId = await transaction(async (client) => {
        // Insert quote
        const quoteResult = await client.query<{ id: string }>(
          `INSERT INTO quotes (package_id, currency, base_amount, tax_amount, markup_amount, fee_amount, discount_amount, final_amount, valid_until, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
           RETURNING id`,
          [
            package_id,
            pricing.currency,
            pricing.base_amount,
            pricing.tax_amount,
            pricing.markup_amount,
            pricing.fee_amount,
            pricing.discount_amount,
            pricing.final_amount,
            validUntil.toISOString(),
          ],
        );
        const newQuoteId = quoteResult.rows[0].id;

        // Insert quote_items with JSONB snapshots of service options
        for (const item of items) {
          const meta = { ...item.metadata, ...item.broker_snapshot };
          const sellAmount = meta.sell_amount != null ? Number(meta.sell_amount) : Number(item.price);
          const costAmount = meta.cost_amount != null ? Number(meta.cost_amount) : sellAmount;
          const snapshot = {
            option_id: item.option_id,
            option_name: item.option_name,
            service_name: item.service_name,
            service_type: item.service_type,
            supplier_name: item.supplier_name,
            price: sellAmount,
            currency: item.currency,
            quantity: item.quantity,
            selected_date: item.selected_date,
            capacity: item.capacity,
            metadata: meta,
            ...(meta.supply_source
              ? {
                  supply_source: meta.supply_source,
                  supply_product: meta.supply_product ?? item.service_type,
                  cost_amount: costAmount,
                  sell_amount: sellAmount,
                  margin_amount: meta.margin_amount ?? sellAmount - costAmount,
                  margin_rule_id: meta.margin_rule_id ?? null,
                  customer_segment: meta.customer_segment ?? 'b2c',
                  curated_listing_id: meta.curated_listing_id,
                  provider_search_ref: meta.provider_search_ref,
                }
              : {}),
          };

          await client.query(
            `INSERT INTO quote_items (quote_id, service_snapshot)
             VALUES ($1, $2)`,
            [newQuoteId, JSON.stringify(snapshot)],
          );
        }

        // Insert quote event
        await client.query(
          `INSERT INTO quote_events (quote_id, event, created_at)
           VALUES ($1, $2, NOW())`,
          [newQuoteId, 'QUOTE_CREATED'],
        );

        // Update package status to QUOTED (lock it from further edits)
        await client.query(
          `UPDATE packages SET status = 'QUOTED' WHERE id = $1`,
          [package_id],
        );

        return newQuoteId;
      });

      // Audit only — booking is created after payment, not at quote time.
      await logAudit(
        'system',
        'quote.generated',
        'quote',
        quoteId,
        { package_id, final_amount: pricing.final_amount },
      );

      logger.info('Quote generated', {
        quote_id: quoteId,
        package_id,
        final_amount: pricing.final_amount,
      });

      return {
        quote_id: quoteId,
        final_amount: pricing.final_amount,
        valid_until: validUntil.toISOString(),
      };
    },

    async getQuote(quoteId: string): Promise<Quote> {
      const quote = await queryOne<Quote>(
        `SELECT id, package_id, currency, base_amount, tax_amount, markup_amount,
                fee_amount, discount_amount, final_amount, valid_until, status, created_at
         FROM quotes WHERE id = $1`,
        [quoteId],
      );
      if (!quote) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }
      return quote;
    },

    async checkExpiry(quoteId: string): Promise<boolean> {
      const quote = await queryOne<{ id: string; valid_until: string; status: string }>(
        `SELECT id, valid_until, status FROM quotes WHERE id = $1`,
        [quoteId],
      );
      if (!quote) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      // Already expired
      if (quote.status === 'EXPIRED') {
        return true;
      }

      // Check if valid_until has passed
      const now = new Date();
      const validUntil = new Date(quote.valid_until);

      if (now > validUntil) {
        // Transition to EXPIRED — allowed by the updated immutability trigger (migration 005)
        await queryOne(
          `UPDATE quotes SET status = 'EXPIRED' WHERE id = $1 AND status = 'ACTIVE' RETURNING id`,
          [quoteId],
        );

        await logAudit('system', 'quote.expired', 'quote', quoteId, { valid_until: quote.valid_until });
        logger.info('Quote expired', { quote_id: quoteId });
        return true;
      }

      return false;
    },


  };
}
