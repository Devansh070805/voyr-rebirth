export interface TripIntent {
  destination: string;
  nights: number;
  days: number;
  travelers: number;
  cityid?: string;
  country?: string;
}

export type FollowUpIntent =
  | 'activities'
  | 'hotels'
  | 'budget'
  | 'itinerary'
  | 'flights'
  | 'tickets'
  | null;
