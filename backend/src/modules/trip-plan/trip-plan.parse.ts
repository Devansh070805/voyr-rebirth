import { emptyTripPlan, type TripPlan } from './trip-plan.types.js';

export function parseTripPlan(raw: Record<string, unknown>): TripPlan {
  const base = emptyTripPlan();
  const live = (raw.live_data as TripPlan['live_data']) || base.live_data;
  return {
    ...base,
    ...raw,
    live_data: {
      hotels: live.hotels ?? [],
      places: live.places ?? [],
      routes: live.routes ?? [],
      curated: live.curated ?? [],
      fetched_at: live.fetched_at ?? null,
    },
    selected_activities: (raw.selected_activities as TripPlan['selected_activities']) ?? [],
    selected_ticket: (raw.selected_ticket as TripPlan['selected_ticket']) ?? null,
    customer_segment: (raw.customer_segment as TripPlan['customer_segment']) ?? 'b2c',
    api_errors: (raw.api_errors as string[]) ?? [],
  };
}

export function serializeTripPlan(plan: TripPlan): Record<string, unknown> {
  return { ...plan };
}
