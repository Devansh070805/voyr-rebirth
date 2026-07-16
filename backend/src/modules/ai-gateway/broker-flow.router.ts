import type { TripPlan } from '../trip-plan/trip-plan.types.js';
import { detectFollowUpIntent, parseTripIntent, parseTripIntentFromHistory } from './trip-intent.js';
import type { ChatMessage } from '../conversation/chat.types.js';

export type BrokerFlowAction =
  | { type: 'followup_cards'; followUp: ReturnType<typeof detectFollowUpIntent> }
  | { type: 'full_plan_cards'; intro: string }
  | { type: 'llm'; reason: string };

export function routeBrokerFlow(
  message: string,
  history: ChatMessage[],
  plan: TripPlan,
): BrokerFlowAction {
  const tripIntent = parseTripIntent(message) || parseTripIntentFromHistory(history, message);
  const followUp = detectFollowUpIntent(message);

  if (followUp && plan.destination) {
    return { type: 'followup_cards', followUp };
  }

  if (tripIntent && plan.destination) {
    const dest = tripIntent.destination.charAt(0).toUpperCase() + tripIntent.destination.slice(1);
    return {
      type: 'full_plan_cards',
      intro: `I'd love to help you plan **${dest}**. I've pulled live options and our Voyr Picks — tap any card to build your trip.`,
    };
  }

  if (/book|checkout|quote|pay now/i.test(message) && plan.selected_hotel) {
    return { type: 'llm', reason: 'checkout_flow' };
  }

  if (tripIntent) {
    return {
      type: 'full_plan_cards',
      intro: `Let's plan **${tripIntent.destination}**. Review the cards below and tell me what you'd like to adjust.`,
    };
  }

  return { type: 'llm', reason: 'general' };
}

export function templateAcknowledgment(message: string, plan: TripPlan): string | null {
  if (/change hotel|different hotel|swap hotel/i.test(message)) {
    return plan.selected_hotel
      ? `Sure — I'll show hotel options again. Your other selections stay as they are.`
      : null;
  }
  if (/change destination|switch to|go to instead/i.test(message)) {
    return `Got it — I'll refresh the plan for your new destination.`;
  }
  return null;
}
