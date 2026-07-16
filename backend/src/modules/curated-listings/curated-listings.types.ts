export const LISTING_TYPES = [
  'hotel',
  'activity',
  'flight',
  'itinerary',
  'ticket',
  'transport',
  'experience',
] as const;

export type ListingType = (typeof LISTING_TYPES)[number];

export type FulfillmentMode = 'manual' | 'inventory';

export type SupplySource =
  | 'curated'
  | 'riya_connect'
  | 'makcorps'
  | 'geoapify'
  | 'aviation_stack'
  | 'inventory'
  | 'all';

export type { CustomerSegment } from '@voyr/shared';

export interface CuratedListing {
  id: string;
  listing_type: ListingType;
  title: string;
  description: string | null;
  destination_slug: string;
  country: string | null;
  city: string | null;
  payload: Record<string, unknown>;
  cost_price: number;
  sell_price: number;
  currency: string;
  priority: number;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_by: string | null;
  inventory_option_id: string | null;
  fulfillment_mode: FulfillmentMode;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateCuratedListingDto {
  listing_type: ListingType;
  title: string;
  description?: string;
  destination_slug: string;
  country?: string;
  city?: string;
  payload?: Record<string, unknown>;
  cost_price: number;
  sell_price: number;
  currency?: string;
  priority?: number;
  is_active?: boolean;
  valid_from?: string;
  valid_to?: string;
  inventory_option_id?: string;
  fulfillment_mode?: FulfillmentMode;
  metadata?: Record<string, unknown>;
}

export type UpdateCuratedListingDto = Partial<CreateCuratedListingDto>;

export interface CuratedListingFilters {
  listing_type?: ListingType;
  destination_slug?: string;
  is_active?: boolean;
}

export interface CuratedListingSnapshot {
  listing_id: string;
  listing_type: ListingType;
  title: string;
  description: string;
  destination_slug: string;
  cost_price: number;
  sell_price: number;
  currency: string;
  source: 'curated';
  featured: true;
  supply_source: 'curated';
  payload: Record<string, unknown>;
  badges: string[];
}

export function normalizeDestinationSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
