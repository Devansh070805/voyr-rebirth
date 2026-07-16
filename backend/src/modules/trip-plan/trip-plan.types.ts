import type { MakcorpsHotel } from '../makcorps/makcorps.service.js';
import type { GeoapifyPlace } from '../geoapify/geoapify.service.js';
import type { Route } from '../aviation-stack/aviation-stack.service.js';
import type { CuratedListingSnapshot } from '../curated-listings/curated-listings.types.js';

export interface SelectedHotel {
  name: string;
  price_per_night: number;
  currency: string;
  category: string;
  rating: number;
  location?: string;
  hotel_id?: number;
  vendor?: string;
  source?: 'curated' | 'api';
  listing_id?: string;
  cost_amount?: number;
  sell_amount?: number;
  supply_source?: string;
}

export interface SelectedActivity {
  name: string;
  description: string;
  duration: string;
  category: string;
  place_id?: string;
  address?: string;
  source?: 'curated' | 'api';
  listing_id?: string;
  price?: number;
  currency?: string;
  cost_amount?: number;
  sell_amount?: number;
}

export interface SelectedFlightRoute {
  route_id: string;
  airline_iata: string;
  departure_iata: string;
  arrival_iata: string;
  label: string;
  source?: 'curated' | 'api';
  listing_id?: string;
  sell_amount?: number;
  cost_amount?: number;
}

export interface SelectedTicket {
  name: string;
  venue?: string;
  event_date?: string;
  seat_class?: string;
  listing_id: string;
  sell_amount: number;
  cost_amount: number;
  currency: string;
}

export interface TripPlanLiveData {
  hotels: MakcorpsHotel[];
  places: GeoapifyPlace[];
  routes: Route[];
  curated: CuratedListingSnapshot[];
  fetched_at: string | null;
}

export interface TripPlan {
  destination: string | null;
  nights: number;
  days: number;
  travelers: number;
  checkin: string | null;
  checkout: string | null;
  cityid: string | null;
  country: string | null;
  customer_segment: 'b2c' | 'b2b';
  selected_hotel: SelectedHotel | null;
  selected_activities: SelectedActivity[];
  selected_flight: SelectedFlightRoute | null;
  selected_ticket: SelectedTicket | null;
  live_data: TripPlanLiveData;
  api_errors: string[];
}

export function emptyTripPlan(): TripPlan {
  return {
    destination: null,
    nights: 3,
    days: 4,
    travelers: 2,
    checkin: null,
    checkout: null,
    cityid: null,
    country: null,
    customer_segment: 'b2c',
    selected_hotel: null,
    selected_activities: [],
    selected_flight: null,
    selected_ticket: null,
    live_data: {
      hotels: [],
      places: [],
      routes: [],
      curated: [],
      fetched_at: null,
    },
    api_errors: [],
  };
}

export type PlanSelectionType =
  | 'hotel'
  | 'activity'
  | 'flight'
  | 'ticket'
  | 'remove_activity';

export type PlanSelectionRequest =
  | { type: 'hotel'; item: SelectedHotel }
  | { type: 'activity'; item: SelectedActivity }
  | { type: 'flight'; item: SelectedFlightRoute }
  | { type: 'ticket'; item: SelectedTicket }
  | { type: 'remove_activity'; item: Pick<SelectedActivity, 'name' | 'listing_id'> };
