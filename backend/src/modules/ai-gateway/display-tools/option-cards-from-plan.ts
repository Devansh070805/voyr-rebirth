import type { PricingService } from '../../pricing/pricing.service.js';
import type { TripPlan } from '../../trip-plan/trip-plan.types.js';
import { capitalize, categorizeHotel, curatedByType, parsePrice, placeCategory } from './plan-helpers.js';

function applyHotelMargin(
  pricing: PricingService | undefined,
  plan: TripPlan,
  basePrice: number,
): { sell: number; cost: number } {
  if (!pricing || basePrice <= 0) return { sell: basePrice, cost: basePrice };
  const result = pricing.applyMarginSync({
    provider: 'makcorps',
    listingType: 'hotel',
    destinationSlug: plan.destination ?? undefined,
    customerSegment: plan.customer_segment,
    basePrice,
  });
  return { sell: result.displayPrice, cost: result.costPrice };
}

export function buildHotelOptionsFromLive(plan: TripPlan, pricing?: PricingService): Record<string, unknown> | null {
  const curatedHotels = curatedByType(plan, 'hotel');
  const hotels = plan.live_data.hotels;
  if (curatedHotels.length === 0 && hotels.length === 0) return null;

  const curatedOptions = curatedHotels.map((c) => {
    const payload = c.payload as Record<string, unknown>;
    const rating = Number(payload.rating ?? 4.5);
    return {
      name: c.title,
      category: (payload.category as string) || 'Voyr Pick',
      price_per_night: Math.round(c.sell_price),
      currency: c.currency,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      highlights: [
        c.description || 'Hand-picked by Voyr',
        ...(Array.isArray(payload.highlights) ? (payload.highlights as string[]) : []),
      ],
      location: (payload.address as string) || plan.destination,
      source: 'curated',
      featured: true,
      listing_id: c.listing_id,
      badges: c.badges,
      cost_amount: c.cost_price,
      sell_amount: c.sell_price,
      supply_source: 'curated',
    };
  });

  const sorted = [...hotels].sort((a, b) => b.reviews.rating - a.reviews.rating);
  const apiOptions = sorted.slice(0, 6).map((hotel) => {
    const base = parsePrice(hotel.price1 || hotel.price2);
    const { sell, cost } = applyHotelMargin(pricing, plan, base);
    const vendor = hotel.vendor1 || hotel.vendor2 || 'OTA';
    return {
      name: hotel.name,
      category: categorizeHotel(sell, hotel.reviews.rating),
      price_per_night: Math.round(sell),
      currency: 'USD',
      rating: Math.min(5, Math.max(1, Math.round(hotel.reviews.rating))),
      highlights: [
        `${hotel.reviews.rating}/5 from ${hotel.reviews.count} reviews`,
        `Live rate via ${vendor}`,
      ],
      location: plan.destination,
      hotel_id: hotel.hotelId,
      vendor,
      source: 'api',
      featured: false,
      cost_amount: cost,
      sell_amount: sell,
      supply_source: 'makcorps',
    };
  });

  const options = [...curatedOptions, ...apiOptions].slice(0, 8);
  if (options.length === 0) return null;

  return {
    destination: capitalize(plan.destination || 'Trip'),
    options,
  };
}

export function buildActivityOptionsFromLive(plan: TripPlan, pricing?: PricingService): Record<string, unknown> | null {
  const curatedActivities = curatedByType(plan, 'activity');
  const places = plan.live_data.places;
  if (curatedActivities.length === 0 && places.length === 0) return null;

  const curatedItems = curatedActivities.map((c) => {
    const payload = c.payload as Record<string, unknown>;
    return {
      name: c.title,
      description: c.description || (payload.address as string) || c.title,
      duration: (payload.duration as string) || 'Half day',
      price: Math.round(c.sell_price),
      currency: c.currency,
      category: (payload.category as string) || 'Experience',
      difficulty: (payload.difficulty as string) || 'Easy',
      source: 'curated',
      featured: true,
      listing_id: c.listing_id,
      badges: c.badges,
      cost_amount: c.cost_price,
      sell_amount: c.sell_price,
      address: payload.address as string | undefined,
    };
  });

  const apiItems = places.slice(0, 8).map((place, index) => {
    let sell = 0;
    if (pricing) {
      sell = pricing.applyMarginSync({
        provider: 'geoapify',
        listingType: 'activity',
        destinationSlug: plan.destination ?? undefined,
        customerSegment: plan.customer_segment,
        basePrice: 0,
      }).displayPrice;
    }
    return {
      name: place.name,
      description: place.address || `Attraction in ${plan.destination}`,
      duration: index % 2 === 0 ? '2-3 hours' : 'Half day',
      price: sell,
      currency: 'USD',
      category: placeCategory(place),
      difficulty: 'Easy',
      place_id: place.id,
      address: place.address,
      price_note: 'Entry fees vary — confirm locally',
      source: 'api',
      featured: false,
      supply_source: 'geoapify',
    };
  });

  return {
    destination: capitalize(plan.destination || 'Trip'),
    activities: [...curatedItems, ...apiItems].slice(0, 10),
  };
}

export function buildFlightOptionsFromLive(plan: TripPlan): Record<string, unknown> | null {
  const curatedFlights = curatedByType(plan, 'flight');
  const routes = plan.live_data.routes;
  if (curatedFlights.length === 0 && routes.length === 0) return null;

  const curatedOptions = curatedFlights.map((c) => {
    const payload = c.payload as Record<string, unknown>;
    return {
      route_id: c.listing_id,
      airline_iata: (payload.airline as string) || 'XX',
      departure_iata: (payload.dep_iata as string) || '',
      arrival_iata: (payload.arr_iata as string) || '',
      label: (payload.label as string) || c.title,
      source: 'curated',
      featured: true,
      listing_id: c.listing_id,
      badges: c.badges,
      sell_amount: c.sell_price,
      cost_amount: c.cost_price,
      currency: c.currency,
    };
  });

  const apiOptions = routes.map((route) => ({
    route_id: route.route_id,
    airline_iata: route.airline_iata,
    departure_iata: route.departure_airport_iata,
    arrival_iata: route.arrival_airport_iata,
    label: `${route.airline_iata} ${route.departure_airport_iata} → ${route.arrival_airport_iata}`,
    source: 'api',
    featured: false,
    supply_source: 'aviation_stack',
  }));

  return {
    destination: capitalize(plan.destination || 'Trip'),
    note: 'Published airline routes (live reference). Fares require a separate quote.',
    options: [...curatedOptions, ...apiOptions].slice(0, 8),
  };
}

export function buildTicketOptionsFromLive(plan: TripPlan): Record<string, unknown> | null {
  const tickets = curatedByType(plan, 'ticket');
  if (tickets.length === 0) return null;

  return {
    destination: capitalize(plan.destination || 'Trip'),
    tickets: tickets.map((c) => {
      const payload = c.payload as Record<string, unknown>;
      return {
        name: c.title,
        venue: payload.venue as string | undefined,
        event_date: payload.event_date as string | undefined,
        seat_class: payload.seat_class as string | undefined,
        listing_id: c.listing_id,
        price: Math.round(c.sell_price),
        currency: c.currency,
        source: 'curated',
        featured: true,
        badges: c.badges,
        cost_amount: c.cost_price,
        sell_amount: c.sell_price,
        description: c.description,
      };
    }),
  };
}
