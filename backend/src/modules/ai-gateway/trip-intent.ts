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
  bali: { cityid: '126995', country: 'Indonesia', keywords: ['bali', 'indonesia', 'ubud'] },
  bangkok: { cityid: '60760', country: 'Thailand', keywords: ['bangkok', 'thailand'] },
  singapore: { cityid: '60746', country: 'Singapore', keywords: ['singapore'] },
  sydney: { cityid: '60748', country: 'Australia', keywords: ['sydney', 'australia'] },
  mumbai: { cityid: '125250', country: 'India', keywords: ['mumbai', 'bombay', 'india'] },
  delhi: { cityid: '125180', country: 'India', keywords: ['delhi', 'new delhi'] },
  goa: { cityid: '125136', country: 'India', keywords: ['goa'] },
  jaipur: { cityid: '125209', country: 'India', keywords: ['jaipur', 'rajasthan'] },
  kochi: { cityid: '125124', country: 'India', keywords: ['kochi', 'cochin', 'kerala'] },
  shanghai: { cityid: '60766', country: 'China', keywords: ['shanghai', 'china'] },
  'hong kong': { cityid: '60764', country: 'China', keywords: ['hong kong'] },
  seoul: { cityid: '60771', country: 'South Korea', keywords: ['seoul', 'korea'] },
  rome: { cityid: '60768', country: 'Italy', keywords: ['rome', 'italy'] },
  barcelona: { cityid: '60747', country: 'Spain', keywords: ['barcelona', 'spain'] },
  amsterdam: { cityid: '60753', country: 'Netherlands', keywords: ['amsterdam', 'netherlands'] },
  istanbul: { cityid: '60765', country: 'Turkey', keywords: ['istanbul', 'turkey'] },
  'los angeles': { cityid: '60762', country: 'USA', keywords: ['los angeles', 'la', 'california'] },
  'san francisco': { cityid: '60759', country: 'USA', keywords: ['san francisco', 'sf', 'bay area'] },
  chicago: { cityid: '60758', country: 'USA', keywords: ['chicago'] },
  'las vegas': { cityid: '60772', country: 'USA', keywords: ['las vegas', 'vegas'] },
  phuket: { cityid: '128618', country: 'Thailand', keywords: ['phuket', 'thailand'] },
  'kuala lumpur': { cityid: '60733', country: 'Malaysia', keywords: ['kuala lumpur', 'malaysia'] },
  'ho chi minh': { cityid: '129112', country: 'Vietnam', keywords: ['ho chi minh', 'saigon', 'vietnam'] },
  hanoi: { cityid: '129148', country: 'Vietnam', keywords: ['hanoi', 'vietnam'] },
};

import type { FollowUpIntent, TripIntent } from '../trip-plan/trip-intent.types.js';

export type { FollowUpIntent, TripIntent } from '../trip-plan/trip-intent.types.js';

export interface DetectedDestination {
  name: string;
  cityid?: string;
  country?: string;
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
  if (/activit|things to do|what to do|attractions|experiences|offering|where are the activit/.test(lower)) {
    return 'activities';
  }
  if (/hotel|stay|accommodation|where to stay|where are the hotel/.test(lower)) {
    return 'hotels';
  }
  if (/flight|airline|route|fly to|flying/.test(lower)) {
    return 'flights';
  }
  if (/ticket|event|concert|show|match/.test(lower)) {
    return 'tickets';
  }
  if (/budget|cost|price|how much|breakdown/.test(lower)) {
    return 'budget';
  }
  if (/itinerary|day by day|schedule|day plan/.test(lower)) {
    return 'itinerary';
  }
  return null;
}

function buildTripIntent(destination: DetectedDestination, message: string): TripIntent {
  const lower = message.toLowerCase();
  let nights = 3;
  let days = 4;
  let travelers = 2;

  const nightMatch = lower.match(/(\d+)\s*-?\s*night/);
  const dayMatch = lower.match(/(\d+)\s*-?\s*day/);
  const peopleMatch = lower.match(
    /(?:for\s+)?(\d+)\s*(?:people|person|travelers?|travellers?|pax|guests?|couple|adults?)/,
  );

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

export function parseTripIntentFromHistory(
  history: Array<{ role: string; content: string }>,
  currentMessage: string,
): TripIntent | null {
  const fromCurrent = parseTripIntent(currentMessage);
  if (fromCurrent) return fromCurrent;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry.role !== 'user') continue;
    const intent = parseTripIntent(entry.content);
    if (intent) return intent;
  }

  const combined = [...history.map((entry) => entry.content), currentMessage].join('\n');
  const destination = detectDestination(combined);
  if (!destination) return null;

  for (const entry of history) {
    if (entry.role === 'user') {
      return buildTripIntent(destination, entry.content);
    }
  }

  return buildTripIntent(destination, currentMessage);
}
