/** Plan selection payloads — mirrors backend trip-plan.types selection shapes. */

/** Optional UI metadata from option cards (ignored by the select API parser). */
interface SelectionCardMeta {
  featured?: boolean;
}

export interface SelectedHotel extends SelectionCardMeta {
  name: string;
  price_per_night: number;
  currency: string;
  category: string;
  rating: number;
  location?: string;
  hotel_id?: number;
  vendor?: string;
  source?: "curated" | "api" | "mock";
  listing_id?: string;
  cost_amount?: number;
  sell_amount?: number;
  supply_source?: string;
}

export interface SelectedActivity extends SelectionCardMeta {
  name: string;
  description: string;
  duration: string;
  category: string;
  place_id?: string;
  address?: string;
  source?: "curated" | "api" | "mock";
  listing_id?: string;
  price?: number;
  currency?: string;
  cost_amount?: number;
  sell_amount?: number;
}

export interface SelectedFlightRoute extends SelectionCardMeta {
  route_id: string;
  airline_iata: string;
  departure_iata: string;
  arrival_iata: string;
  label: string;
  source?: "curated" | "api" | "mock";
  listing_id?: string;
  sell_amount?: number;
  cost_amount?: number;
}

export interface SelectedTicket extends SelectionCardMeta {
  name: string;
  venue?: string;
  event_date?: string;
  seat_class?: string;
  listing_id: string;
  sell_amount: number;
  cost_amount: number;
  currency: string;
}

export type PlanSelectionType = "hotel" | "activity" | "flight" | "ticket";

export type PlanSelectionItem =
  | SelectedHotel
  | SelectedActivity
  | SelectedFlightRoute
  | SelectedTicket;
