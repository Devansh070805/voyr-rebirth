import type { MakcorpsService } from '../makcorps/makcorps.service.js';
import type { GeoapifyService } from '../geoapify/geoapify.service.js';
import type { AviationStackService } from '../aviation-stack/aviation-stack.service.js';
import type { Route } from '../aviation-stack/aviation-stack.service.js';
import type { CuratedListingsService } from '../curated-listings/curated-listings.service.js';
import type { CuratedListingSnapshot } from '../curated-listings/curated-listings.types.js';
import { createLogger } from '../../infra/logger.js';
import { redisClient } from '../../infra/redis.js';
import { createTravelSupplyRegistry, type TravelSupplyRegistry } from '../travel-supply/index.js';
import type { TripIntent } from './trip-intent.types.js';
import {
  emptyTripPlan,
  type PlanSelectionRequest,
  type TripPlan,
} from './trip-plan.types.js';
import { getTripDates, parsePrice } from './trip-plan.utils.js';

const logger = createLogger('trip-plan');

/** Primary airport IATA for Makcorps/Aviation Stack routing (real reference data, not mock content). */
export const DESTINATION_AIRPORT_IATA: Record<string, string> = {
  bali: 'DPS',
  dubai: 'DXB',
  bangkok: 'BKK',
  singapore: 'SIN',
  tokyo: 'NRT',
  paris: 'CDG',
  london: 'LHR',
  sydney: 'SYD',
  phuket: 'HKT',
  'kuala lumpur': 'KUL',
  mumbai: 'BOM',
  delhi: 'DEL',
  goa: 'GOI',
};

export interface TripPlanServiceDeps {
  makcorps: MakcorpsService;
  geoapify: GeoapifyService;
  aviationStack: AviationStackService;
  curatedListings: CuratedListingsService;
}

function getTripDatesForPlan(nights: number): { checkin: string; checkout: string } {
  return getTripDates(nights);
}

function categorizeHotel(price: number, rating: number): string {
  if (price >= 200 || rating >= 4.5) return 'Luxury';
  if (price >= 80 || rating >= 4) return 'Mid-Range';
  return 'Budget';
}

function placeCategory(categories: string[]): string {
  const cats = categories.join(' ').toLowerCase();
  if (cats.includes('catering') || cats.includes('restaurant')) return 'Food';
  if (cats.includes('beach') || cats.includes('water')) return 'Water';
  if (cats.includes('park') || cats.includes('nature')) return 'Nature';
  if (cats.includes('museum') || cats.includes('heritage') || cats.includes('sights')) return 'Cultural';
  return 'Adventure';
}

function isStale(plan: TripPlan): boolean {
  if (!plan.live_data.fetched_at) return true;
  const ageMs = Date.now() - new Date(plan.live_data.fetched_at).getTime();
  return ageMs > 60 * 60 * 1000;
}

export function mergeIntentIntoPlan(plan: TripPlan, intent: TripIntent): TripPlan {
  const dates = getTripDatesForPlan(intent.nights);
  return {
    ...plan,
    destination: intent.destination,
    nights: intent.nights,
    days: intent.days,
    travelers: intent.travelers,
    cityid: intent.cityid ?? plan.cityid,
    country: intent.country ?? plan.country,
    checkin: dates.checkin,
    checkout: dates.checkout,
  };
}

export function createTripPlanService(deps: TripPlanServiceDeps) {
  const supply: TravelSupplyRegistry = createTravelSupplyRegistry({
    makcorps: deps.makcorps,
    geoapify: deps.geoapify,
    aviationStack: deps.aviationStack,
    curatedListings: deps.curatedListings,
  });

  /** Redis cache is optional — read/write failures fall through to the live loader. */
  async function fetchCachedLiveSlice<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    try {
      const cached = await redisClient.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch (err) {
      logger.warn('Redis cache read failed', { key, error: (err as Error).message });
    }
    const value = await loader();
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.warn('Redis cache write failed', { key, error: (err as Error).message });
    }
    return value;
  }

  async function fetchLiveData(plan: TripPlan): Promise<TripPlan> {
    const next: TripPlan = {
      ...plan,
      live_data: { hotels: [], places: [], routes: [], curated: [], fetched_at: new Date().toISOString() },
      api_errors: [],
    };

    if (plan.destination) {
      try {
        const cacheKey = `supply:curated:${plan.destination.toLowerCase()}`;
        const offers = await fetchCachedLiveSlice(cacheKey, 3600, () =>
          supply.get('curated')!.search({ destinationSlug: plan.destination! }),
        );
        next.live_data.curated = offers.map((o) => o.raw as CuratedListingSnapshot);
      } catch (err) {
        logger.warn('Curated listings fetch failed', { error: (err as Error).message });
        next.api_errors.push('Voyr Picks are temporarily unavailable.');
      }
    }

    if (plan.cityid && plan.checkin && plan.checkout) {
      try {
        const cacheKey = `supply:makcorps:${plan.cityid}:${plan.checkin}:${plan.checkout}:${plan.travelers}`;
        const hotelOffers = await fetchCachedLiveSlice(cacheKey, 86400, () =>
          supply.get('makcorps')!.search({
            product: 'hotel',
            cityid: plan.cityid!,
            checkin: plan.checkin!,
            checkout: plan.checkout!,
            travelers: plan.travelers,
            limit: 12,
          }),
        );
        next.live_data.hotels = hotelOffers.map((o) => o.raw as TripPlan['live_data']['hotels'][number]);
        if (next.live_data.hotels.length === 0 && next.live_data.curated.filter((c) => c.listing_type === 'hotel').length === 0) {
          next.api_errors.push('No live hotel rates returned for this destination and dates.');
        }
      } catch (err) {
        logger.warn('Hotel search failed', { error: (err as Error).message });
        next.api_errors.push('Live hotel rates are temporarily unavailable.');
      }
    } else if (plan.destination && next.live_data.curated.filter((c) => c.listing_type === 'hotel').length === 0) {
      next.api_errors.push('Hotel search needs a supported destination with a mapped city ID.');
    }

    if (plan.destination) {
      try {
        const searchText = plan.country ? `${plan.destination}, ${plan.country}` : plan.destination;
        const placesCacheKey = `supply:geoapify:${searchText.toLowerCase()}`;
        const placeOffers = await fetchCachedLiveSlice(placesCacheKey, 21600, () =>
          supply.get('geoapify')!.search({
            product: 'activity',
            destinationSlug: searchText,
            limit: 12,
          }),
        );
        next.live_data.places = placeOffers.map((o) => o.raw as TripPlan['live_data']['places'][number]);
        if (next.live_data.places.length === 0 && next.live_data.curated.filter((c) => c.listing_type === 'activity').length === 0) {
          next.api_errors.push('No attractions or activities found for this destination.');
        }
      } catch (err) {
        logger.warn('Activity search failed', { error: (err as Error).message });
        next.api_errors.push('Live activity search is temporarily unavailable.');
      }
    }

    const arrivalIata = plan.destination
      ? DESTINATION_AIRPORT_IATA[plan.destination.toLowerCase()]
      : undefined;

    if (arrivalIata) {
      try {
        const routesCacheKey = `supply:aviation:${arrivalIata}`;
        const routeOffers = await fetchCachedLiveSlice(routesCacheKey, 86400, () =>
          supply.get('aviation_stack')!.search({
            product: 'flight',
            arrivalIata,
            limit: 8,
          }),
        );
        next.live_data.routes = routeOffers.map((o) => o.raw as Route);
        if (next.live_data.routes.length === 0 && next.live_data.curated.filter((c) => c.listing_type === 'flight').length === 0) {
          next.api_errors.push(`No published airline routes found to ${arrivalIata}.`);
        }
      } catch (err) {
        logger.warn('Flight route data fetch failed', { error: (err as Error).message });
        next.api_errors.push('Flight route data is temporarily unavailable.');
      }
    }

    return next;
  }

  async function ensureFreshPlan(plan: TripPlan, intent?: TripIntent | null): Promise<TripPlan> {
    let merged = intent ? mergeIntentIntoPlan(plan, intent) : plan;
    if (isStale(merged) && merged.destination) {
      merged = await fetchLiveData(merged);
    }
    return merged;
  }

  function applySelection(plan: TripPlan, selection: PlanSelectionRequest): TripPlan {
    switch (selection.type) {
      case 'hotel':
        return { ...plan, selected_hotel: selection.item };
      case 'activity': {
        const activity = selection.item;
        const exists = plan.selected_activities.some(
          (a) => a.listing_id && activity.listing_id
            ? a.listing_id === activity.listing_id
            : a.name === activity.name,
        );
        if (exists) return plan;
        return { ...plan, selected_activities: [...plan.selected_activities, activity] };
      }
      case 'remove_activity': {
        const { name, listing_id: listingId } = selection.item;
        return {
          ...plan,
          selected_activities: plan.selected_activities.filter((a) => {
            if (listingId && a.listing_id === listingId) return false;
            if (listingId && !a.listing_id && a.name === name) return false;
            if (!listingId && a.name === name) return false;
            return true;
          }),
        };
      }
      case 'flight':
        return { ...plan, selected_flight: selection.item };
      case 'ticket':
        return { ...plan, selected_ticket: selection.item };
      default:
        return plan;
    }
  }

  function buildPlanSummary(plan: TripPlan): string {
    const lines: string[] = [];
    if (plan.destination) {
      lines.push(`Destination: ${plan.destination} (${plan.nights} nights, ${plan.travelers} travelers)`);
    }
    if (plan.selected_hotel) {
      lines.push(`Selected hotel: ${plan.selected_hotel.name} at ${plan.selected_hotel.currency} ${plan.selected_hotel.price_per_night}/night`);
    }
    if (plan.selected_activities.length > 0) {
      lines.push(`Selected activities: ${plan.selected_activities.map((a) => a.name).join(', ')}`);
    }
    if (plan.selected_flight) {
      lines.push(`Selected flight route: ${plan.selected_flight.label}`);
    }
    if (plan.selected_ticket) {
      lines.push(`Selected ticket: ${plan.selected_ticket.name}`);
    }
    const curatedCount = plan.live_data.curated.length;
    if (curatedCount > 0) {
      lines.push(`Voyr Pick listings: ${plan.live_data.curated.slice(0, 4).map((c) => c.title).join(', ')}`);
    }
    if (plan.live_data.hotels.length > 0) {
      lines.push(`Live hotels available: ${plan.live_data.hotels.slice(0, 3).map((h) => h.name).join(', ')}`);
    }
    if (plan.live_data.places.length > 0) {
      lines.push(`Live activities available: ${plan.live_data.places.slice(0, 4).map((p) => p.name).join(', ')}`);
    }
    if (plan.api_errors.length > 0) {
      lines.push(`Data gaps: ${plan.api_errors.join('; ')}`);
    }
    return lines.join('\n');
  }

  function hotelFromMakcorps(hotel: import('../makcorps/makcorps.service.js').MakcorpsHotel): import('./trip-plan.types.js').SelectedHotel {
    const price = parsePrice(hotel.price1 || hotel.price2);
    return {
      name: hotel.name,
      price_per_night: Math.round(price) || 0,
      currency: 'USD',
      category: categorizeHotel(price, hotel.reviews.rating),
      rating: Math.min(5, Math.max(1, Math.round(hotel.reviews.rating))),
      location: undefined,
      hotel_id: hotel.hotelId,
      vendor: hotel.vendor1 || hotel.vendor2,
      source: 'api',
      supply_source: 'makcorps',
    };
  }

  function activityFromPlace(place: import('../geoapify/geoapify.service.js').GeoapifyPlace, index: number): import('./trip-plan.types.js').SelectedActivity {
    return {
      name: place.name,
      description: place.address || place.name,
      duration: index % 2 === 0 ? '2-3 hours' : 'Half day',
      category: placeCategory(place.categories),
      place_id: place.id,
      address: place.address,
      source: 'api',
    };
  }

  return {
    emptyTripPlan,
    mergeIntentIntoPlan,
    ensureFreshPlan,
    fetchLiveData,
    applySelection,
    buildPlanSummary,
    hotelFromMakcorps,
    activityFromPlace,
    selectionConfirmationMessage(plan: TripPlan, selection: PlanSelectionRequest): string {
      switch (selection.type) {
        case 'hotel':
          return `Got it — **${plan.selected_hotel?.name}** is now your hotel. I've updated your itinerary and budget below.`;
        case 'activity':
          return `Added **${selection.item.name}** to your trip. You can keep selecting or ask me to adjust the schedule.`;
        case 'remove_activity':
          return `Removed **${selection.item.name}** from your plan.`;
        case 'flight':
          return `Noted your preferred route: **${plan.selected_flight?.label}**. I can help compare alternatives or move to booking when you're ready.`;
        case 'ticket':
          return `**${plan.selected_ticket?.name}** is on your plan. I'll include it in your quote when you're ready to book.`;
        default:
          return 'Your plan has been updated.';
      }
    },
  };
}

export type TripPlanService = ReturnType<typeof createTripPlanService>;
