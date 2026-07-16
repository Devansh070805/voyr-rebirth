import type { TripPlan } from '../../trip-plan/trip-plan.types.js';
import { capitalize, curatedByType, parsePrice, placeCategory } from './plan-helpers.js';

interface CuratedItineraryDay {
  title: string;
  day_number?: number;
  description?: string;
}

interface CuratedItineraryPayload {
  days?: CuratedItineraryDay[];
}

export function buildItineraryFromPlan(plan: TripPlan): Record<string, unknown> | null {
  if (!plan.destination) return null;

  const curatedItinerary = curatedByType(plan, 'itinerary')[0];
  if (curatedItinerary) {
    const payload = curatedItinerary.payload as CuratedItineraryPayload;
    const daysPlan = payload.days;
    if (Array.isArray(daysPlan) && daysPlan.length > 0) {
      return {
        destination: capitalize(plan.destination),
        nights: plan.nights,
        days: plan.days,
        travelers: plan.travelers,
        estimated_budget: Math.round(curatedItinerary.sell_price),
        trip_type: ['Recommended by Voyr'],
        highlights: daysPlan.slice(0, 4).map((d) => d.title),
        days_plan: daysPlan,
        curated: true,
        listing_id: curatedItinerary.listing_id,
      };
    }
  }

  const activityPool = plan.selected_activities.length > 0
    ? plan.selected_activities.map((a) => ({
        name: a.name,
        description: a.description,
        category: a.category,
      }))
    : [
        ...curatedByType(plan, 'activity').map((c) => ({
          name: c.title,
          description: c.description,
          category: (c.payload.category as string) || 'Experience',
        })),
        ...plan.live_data.places.map((p) => ({
          name: p.name,
          description: p.address || p.name,
          category: placeCategory(p),
        })),
      ];

  if (activityPool.length === 0) return null;

  const highlights = activityPool.slice(0, 4).map((a) => a.name);

  const dayCount = Math.max(1, plan.days);
  const daysPlan = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1;
    const activity = activityPool[index % activityPool.length];

    if (dayNumber === 1) {
      return {
        day_number: 1,
        title: plan.selected_hotel
          ? `Arrival — ${plan.selected_hotel.name}`
          : 'Arrival & check-in',
        description: plan.selected_hotel
          ? `Check in at ${plan.selected_hotel.name} and explore the area nearby.`
          : `Arrive in ${capitalize(plan.destination || 'your destination')}, check in, and ease into the trip.`,
        activities: [
          {
            name: plan.selected_hotel?.name || 'Airport transfer & check-in',
            description: plan.selected_hotel
              ? `Stay at ${plan.selected_hotel.name}`
              : 'Transfer to hotel and settle in',
            duration_hours: 2,
            category: 'Transfer',
          },
        ],
      };
    }

    return {
      day_number: dayNumber,
      title: activity.name,
      description: activity.description,
      activities: [
        {
          name: activity.name,
          description: activity.description,
          duration_hours: 3,
          category: activity.category,
        },
      ],
    };
  });

  const hotelNightly = plan.selected_hotel?.price_per_night
    ?? (plan.live_data.hotels[0]
      ? parsePrice(plan.live_data.hotels[0].price1)
      : curatedByType(plan, 'hotel')[0]?.sell_price
      ?? 0);
  const estimatedBudget = Math.round(
    hotelNightly * plan.nights
    + plan.selected_activities.length * 40
    + (plan.selected_flight ? 500 : 450)
    + (plan.selected_ticket?.sell_amount ?? 0),
  );

  return {
    destination: capitalize(plan.destination),
    nights: plan.nights,
    days: plan.days,
    travelers: plan.travelers,
    estimated_budget: estimatedBudget,
    trip_type: ['Sightseeing', 'Culture', 'Relaxation'],
    highlights,
    days_plan: daysPlan,
    selected_hotel: plan.selected_hotel?.name ?? null,
    selected_flight: plan.selected_flight?.label ?? null,
  };
}
