import type { PricingService } from '../pricing/pricing.service.js';
import type { TripPlan } from '../trip-plan/trip-plan.types.js';
import { buildBudgetFromPlan } from './display-tools/budget-from-plan.js';
import { buildItineraryFromPlan } from './display-tools/itinerary-from-plan.js';
import {
  buildActivityOptionsFromLive,
  buildFlightOptionsFromLive,
  buildHotelOptionsFromLive,
  buildTicketOptionsFromLive,
} from './display-tools/option-cards-from-plan.js';
import { nextToolId } from './display-tools/plan-helpers.js';
import type { DisplayToolCall } from './display-tools/types.js';

export type { DisplayToolCall } from './display-tools/types.js';
export {
  DISPLAY_TOOL_NAMES,
  DISPLAY_SUGGESTIONS,
  ACTIVITY_FOLLOW_UP_SUGGESTIONS,
  followUpIntroText,
  planDataGapMessage,
} from './display-tools/types.js';

export function buildDisplayToolsFromPlan(
  plan: TripPlan,
  pricing?: PricingService,
  idPrefix = 'plan',
): DisplayToolCall[] {
  const tools: DisplayToolCall[] = [];
  let counter = 0;

  const itinerary = buildItineraryFromPlan(plan);
  if (itinerary) {
    tools.push({ id: nextToolId(idPrefix, 'show_itinerary', counter++), name: 'show_itinerary', arguments: itinerary });
  }

  const hotels = buildHotelOptionsFromLive(plan, pricing);
  if (hotels) {
    tools.push({ id: nextToolId(idPrefix, 'show_hotel_options', counter++), name: 'show_hotel_options', arguments: hotels });
  }

  const activities = buildActivityOptionsFromLive(plan, pricing);
  if (activities) {
    tools.push({ id: nextToolId(idPrefix, 'show_activity_options', counter++), name: 'show_activity_options', arguments: activities });
  }

  const flights = buildFlightOptionsFromLive(plan);
  if (flights) {
    tools.push({ id: nextToolId(idPrefix, 'show_flight_options', counter++), name: 'show_flight_options', arguments: flights });
  }

  const tickets = buildTicketOptionsFromLive(plan);
  if (tickets) {
    tools.push({ id: nextToolId(idPrefix, 'show_ticket_options', counter++), name: 'show_ticket_options', arguments: tickets });
  }

  const budget = buildBudgetFromPlan(plan);
  if (budget) {
    tools.push({ id: nextToolId(idPrefix, 'show_budget_breakdown', counter++), name: 'show_budget_breakdown', arguments: budget });
  }

  return tools;
}

export function buildFollowUpToolsFromPlan(
  plan: TripPlan,
  followUp: 'activities' | 'hotels' | 'budget' | 'itinerary' | 'flights' | 'tickets',
  pricing?: PricingService,
  idPrefix = 'followup',
): DisplayToolCall[] {
  let counter = 0;
  const tools: DisplayToolCall[] = [];

  const push = (name: string, args: Record<string, unknown> | null) => {
    if (!args) return;
    tools.push({ id: nextToolId(idPrefix, name, counter++), name, arguments: args });
  };

  if (followUp === 'activities') push('show_activity_options', buildActivityOptionsFromLive(plan, pricing));
  if (followUp === 'hotels') push('show_hotel_options', buildHotelOptionsFromLive(plan, pricing));
  if (followUp === 'budget') push('show_budget_breakdown', buildBudgetFromPlan(plan));
  if (followUp === 'itinerary') push('show_itinerary', buildItineraryFromPlan(plan));
  if (followUp === 'flights') push('show_flight_options', buildFlightOptionsFromLive(plan));
  if (followUp === 'tickets') push('show_ticket_options', buildTicketOptionsFromLive(plan));

  return tools;
}
