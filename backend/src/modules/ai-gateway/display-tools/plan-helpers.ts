import type { GeoapifyPlace } from '../../geoapify/geoapify.service.js';
import type { CuratedListingSnapshot } from '../../curated-listings/curated-listings.types.js';
import type { TripPlan } from '../../trip-plan/trip-plan.types.js';
import { capitalize, parsePrice } from '../../../utils/format.js';

export function categorizeHotel(price: number, rating: number): string {
  if (price >= 200 || rating >= 4.5) return 'Luxury';
  if (price >= 80 || rating >= 4) return 'Mid-Range';
  return 'Budget';
}

export function placeCategory(place: GeoapifyPlace): string {
  const cats = place.categories.join(' ').toLowerCase();
  if (cats.includes('catering') || cats.includes('restaurant')) return 'Food';
  if (cats.includes('beach') || cats.includes('water')) return 'Water';
  if (cats.includes('park') || cats.includes('nature')) return 'Nature';
  if (cats.includes('museum') || cats.includes('heritage') || cats.includes('sights')) return 'Cultural';
  return 'Adventure';
}

export function nextToolId(prefix: string, name: string, counter: number): string {
  return `${prefix}-${name}-${Date.now()}-${counter++}`;
}

export function curatedByType(
  plan: TripPlan,
  type: CuratedListingSnapshot['listing_type'],
): CuratedListingSnapshot[] {
  return plan.live_data.curated.filter((c) => c.listing_type === type);
}

export { capitalize, parsePrice };
