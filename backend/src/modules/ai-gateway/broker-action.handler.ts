import type { Response } from 'express';
import type { PricingService } from '../pricing/pricing.service.js';
import type { TripPlan } from '../trip-plan/trip-plan.types.js';
import type { StreamEvent } from './ai-stream.service.js';
import {
  buildDisplayToolsFromPlan,
  buildFollowUpToolsFromPlan,
  DISPLAY_SUGGESTIONS,
  ACTIVITY_FOLLOW_UP_SUGGESTIONS,
  followUpIntroText,
  planDataGapMessage,
} from './display-tools-builder.js';
import {
  templateAcknowledgment,
  type BrokerFlowAction,
} from './broker-flow.router.js';

export function writeSSE(res: Response, event: StreamEvent): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function emitPlanCards(
  plan: TripPlan,
  write: (event: StreamEvent) => void,
  pricing: PricingService,
  mode: 'full' | 'followup',
  followUp?: 'activities' | 'hotels' | 'budget' | 'itinerary' | 'flights' | 'tickets',
): boolean {
  const tools = mode === 'followup' && followUp
    ? buildFollowUpToolsFromPlan(plan, followUp, pricing)
    : buildDisplayToolsFromPlan(plan, pricing);

  if (tools.length === 0) return false;
  for (const tool of tools) {
    write({ type: 'tool_call', data: tool });
  }
  write({
    type: 'suggestions',
    data: followUp === 'activities' ? ACTIVITY_FOLLOW_UP_SUGGESTIONS : DISPLAY_SUGGESTIONS,
  });
  return true;
}

function buildCardIntro(
  action: BrokerFlowAction,
  message: string,
  plan: TripPlan,
): string {
  const ack = templateAcknowledgment(message, plan);
  if (action.type === 'followup_cards' && action.followUp) {
    const intro = followUpIntroText(action.followUp, plan);
    return (ack ? `${ack}\n\n` : '') + intro + (planDataGapMessage(plan) || '');
  }
  if (action.type === 'full_plan_cards') {
    return (ack ? `${ack}\n\n` : '') + action.intro + (planDataGapMessage(plan) || '');
  }
  return '';
}

export interface BrokerCardActionResult {
  handled: boolean;
  introText?: string;
}

export async function executeBrokerCardAction(params: {
  action: BrokerFlowAction;
  message: string;
  plan: TripPlan;
  pricing: PricingService;
  write: (event: StreamEvent) => void;
}): Promise<BrokerCardActionResult> {
  const { action, message, plan, pricing, write } = params;

  if (action.type === 'followup_cards' && action.followUp) {
    const introText = buildCardIntro(action, message, plan);
    write({ type: 'text_delta', data: { text: introText } });
    emitPlanCards(plan, write, pricing, 'followup', action.followUp);
    return { handled: true, introText };
  }

  if (action.type === 'full_plan_cards') {
    const introText = buildCardIntro(action, message, plan);
    write({ type: 'text_delta', data: { text: introText } });
    emitPlanCards(plan, write, pricing, 'full');
    return { handled: true, introText };
  }

  return { handled: false };
}

export const SUPPLY_DATA_TOOLS = new Set(['search_hotels', 'search_places', 'search_flights']);

export function planNeedsSupplyRefresh(pendingToolNames: string[]): boolean {
  return pendingToolNames.some((name) => SUPPLY_DATA_TOOLS.has(name));
}
