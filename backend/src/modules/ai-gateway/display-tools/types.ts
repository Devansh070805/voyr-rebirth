import type { ToolCall } from '../ai-stream.service.js';
import type { TripPlan } from '../../trip-plan/trip-plan.types.js';
import { capitalize, curatedByType } from './plan-helpers.js';

export type DisplayToolCall = ToolCall;

export const DISPLAY_TOOL_NAMES = new Set([
  'show_itinerary',
  'show_budget_breakdown',
  'show_hotel_options',
  'show_activity_options',
  'show_flight_options',
  'show_ticket_options',
  'show_comparison',
  'show_visa_info',
]);

export const DISPLAY_SUGGESTIONS = [
  'Show flight routes to this destination',
  'Compare hotel options',
  'Add another activity',
  'I am ready to book this trip',
];

export const ACTIVITY_FOLLOW_UP_SUGGESTIONS = [
  'Add this to my day 2 schedule',
  'Show hotel options',
  'Show flight routes',
  'Update my budget',
];

export function followUpIntroText(
  followUp: 'activities' | 'hotels' | 'budget' | 'itinerary' | 'flights' | 'tickets',
  plan: TripPlan,
): string {
  const dest = capitalize(plan.destination || 'your trip');
  const hasCurated = plan.live_data.curated.length > 0;
  switch (followUp) {
    case 'activities':
      return plan.live_data.places.length > 0 || curatedByType(plan, 'activity').length > 0
        ? `Here are **experiences in ${dest}**${hasCurated ? ' — Voyr Picks shown first' : ''}:`
        : `I couldn't load activities for ${dest} right now. ${plan.api_errors[0] || 'Please try again in a moment.'}`;
    case 'hotels':
      return plan.live_data.hotels.length > 0 || curatedByType(plan, 'hotel').length > 0
        ? `These **hotels** are available for ${dest}${hasCurated ? ' — our picks are listed first' : ''}:`
        : `Live hotel rates aren't available for ${dest} yet. ${plan.api_errors.find((e) => e.includes('Hotel')) || plan.api_errors[0] || ''}`;
    case 'flights':
      return plan.live_data.routes.length > 0 || curatedByType(plan, 'flight').length > 0
        ? `**Routes** serving ${dest}:`
        : `Flight route data isn't available. ${plan.api_errors.find((e) => e.includes('Flight')) || ''}`;
    case 'tickets':
      return curatedByType(plan, 'ticket').length > 0
        ? `**Tickets and events** for ${dest}:`
        : `No ticket listings for ${dest} yet.`;
    case 'budget':
      return `Updated **budget breakdown** for ${dest} based on your current selections:`;
    case 'itinerary':
      return curatedByType(plan, 'itinerary').length > 0
        ? `Your **recommended itinerary** for ${dest}:`
        : `Your **day-by-day plan** for ${dest}:`;
    default:
      return '';
  }
}

export function planDataGapMessage(plan: TripPlan): string | null {
  return null;
}
