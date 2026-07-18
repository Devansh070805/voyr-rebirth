export interface KnownDestination {
  cityid: string;
  country: string;
  keywords: string[];
}

export const KNOWN_DESTINATIONS: Record<string, KnownDestination> = {
  'new york': { cityid: '60763', country: 'USA', keywords: ['new york', 'nyc', 'manhattan', 'brooklyn'] },
  paris: { cityid: '60745', country: 'France', keywords: ['paris', 'france'] },
  london: { cityid: '60783', country: 'UK', keywords: ['london', 'england', 'uk'] },
  tokyo: { cityid: '60732', country: 'Japan', keywords: ['tokyo', 'japan'] },
  dubai: { cityid: '60716', country: 'UAE', keywords: ['dubai', 'uae'] },
  bali: { cityid: '602651', country: 'Indonesia', keywords: ['bali', 'indonesia'] },
};

import type { FollowUpIntent, TripIntent } from '../trip-plan/trip-intent.types.js';
export type { FollowUpIntent, TripIntent } from '../trip-plan/trip-intent.types.js';
import type { ChatMessage } from '../conversation/chat.types.js';

export interface DetectedDestination {
  name: string;
  cityid?: string;
  country?: string;
}

export interface StructuredTripPayload {
  suggested_itinerary: string;
  day_schedules: { day: number; activities: string[] }[];
  geo_coordinates: { lat: number; lng: number };
  curated_stays: string[];
  essential_notes: string[];
  estimated_budget: string;
}

export function generateMockStructuredPayload(intent: TripIntent): StructuredTripPayload {
  return {
    suggested_itinerary: `A beautiful ${intent.days}-day journey to ${intent.destination}.`,
    day_schedules: Array.from({ length: intent.days }).map((_, i) => ({
      day: i + 1,
      activities: ['Morning City Tour', 'Local Lunch Experience', 'Evening Relaxation']
    })),
    geo_coordinates: { lat: 35.6762, lng: 139.6503 }, // Mock center
    curated_stays: ['Premium City Center Hotel', 'Boutique Lodge'],
    essential_notes: ['Carry local currency', 'Check visa requirements'],
    estimated_budget: `$${intent.travelers * 1200} - $${intent.travelers * 2500}`
  };
}

export function detectDestination(message: string): DetectedDestination | null {
  const lower = message.toLowerCase();
  for (const [name, info] of Object.entries(KNOWN_DESTINATIONS)) {
    if (info.keywords.some((kw) => lower.includes(kw))) {
      return { name, cityid: info.cityid, country: info.country };
    }
  }
  return null;
}

export function parseTripIntent(message: string): TripIntent | null {
  const destination = detectDestination(message);
  if (!destination) return null;

  return buildTripIntent(destination, message);
}

export function detectFollowUpIntent(message: string): FollowUpIntent {
  const lower = message.toLowerCase();
  if (/activit|things to do|what to do/.test(lower)) return 'activities';
  if (/hotel|stay|accommodation/.test(lower)) return 'hotels';
  if (/flight|airline|route/.test(lower)) return 'flights';
  if (/budget|cost|price/.test(lower)) return 'budget';
  if (/itinerary|day by day/.test(lower)) return 'itinerary';
  if (/ticket|show/.test(lower)) return 'tickets';
  return null;
}

function buildTripIntent(destination: DetectedDestination, message: string): TripIntent {
  const lower = message.toLowerCase();
  let nights = 3;
  let days = 4;
  let travelers = 2;

  const nightMatch = lower.match(/(\d+)\s*-?\s*night/);
  const dayMatch = lower.match(/(\d+)\s*-?\s*day/);
  const peopleMatch = lower.match(/(?:for\s+)?(\d+)\s*(?:people|person|travelers?)/);

  if (nightMatch) {
    nights = Math.max(1, parseInt(nightMatch[1], 10));
    days = nights + 1;
  } else if (dayMatch) {
    days = Math.max(1, parseInt(dayMatch[1], 10));
    nights = Math.max(1, days - 1);
  }

  if (peopleMatch) {
    travelers = Math.max(1, parseInt(peopleMatch[1], 10));
  } else if (lower.includes('couple')) {
    travelers = 2;
  }

  return {
    destination: destination.name,
    nights,
    days,
    travelers,
    cityid: destination.cityid,
    country: destination.country,
  };
}

export function parseTripIntentFromHistory(history: ChatMessage[], currentMessage: string): TripIntent | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') {
      const dest = detectDestination(history[i].content);
      if (dest) {
        const combined = history[i].content + ' ' + currentMessage;
        return buildTripIntent(dest, combined);
      }
    }
  }
  return null;
}
