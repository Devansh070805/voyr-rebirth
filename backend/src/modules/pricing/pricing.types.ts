/**
 * Pricing types — shared API contracts re-exported from @voyr/shared.
 * Backend-only input/output types remain here.
 */

import type { ListingType, SupplySource } from '../curated-listings/curated-listings.types.js';

export type {
  CustomerSegment,
  MarginType,
  MarginRule,
  ApplyMarginResult,
  CreateMarginRuleDto,
  UpdateMarginRuleDto,
} from '@voyr/shared';

import type { CustomerSegment } from '@voyr/shared';

export interface ApplyMarginInput {
  provider: SupplySource | string;
  listingType?: ListingType | string;
  destinationSlug?: string;
  customerSegment?: CustomerSegment;
  basePrice: number;
}

export interface SupplyLineSnapshot {
  supply_source: string;
  supply_product: string;
  cost_amount: number;
  sell_amount: number;
  margin_amount: number;
  margin_rule_id: string | null;
  customer_segment: CustomerSegment;
  curated_listing_id?: string;
  provider_search_ref?: string;
  currency?: string;
}
