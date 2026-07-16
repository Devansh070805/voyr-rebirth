export type ListingTabKey = "hotel" | "activity" | "flight" | "itinerary" | "ticket";

export const LISTING_TABS: { key: ListingTabKey; label: string }[] = [
  { key: "hotel", label: "Hotels" },
  { key: "activity", label: "Activities" },
  { key: "flight", label: "Flights" },
  { key: "itinerary", label: "Itineraries" },
  { key: "ticket", label: "Tickets" },
];

export interface CuratedListingRow {
  id: string;
  listing_type: ListingTabKey;
  title: string;
  description: string | null;
  destination_slug: string;
  payload: Record<string, unknown>;
  cost_price: number;
  sell_price: number;
  currency: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListingEditRow {
  id: string;
  listing_type: ListingTabKey;
  title: string;
  description: string;
  destination_slug: string;
  payload_json: string;
  cost_price: number;
  sell_price: number;
  currency: string;
  priority: number;
  is_active: boolean;
}

export const EMPTY_LISTING: ListingEditRow = {
  id: "",
  listing_type: "hotel",
  title: "",
  description: "",
  destination_slug: "",
  payload_json: "{}",
  cost_price: 0,
  sell_price: 0,
  currency: "INR",
  priority: 0,
  is_active: true,
};
