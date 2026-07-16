import type { PricingService } from '../pricing/pricing.service.js';
import type { TripPlan } from '../trip-plan/trip-plan.types.js';
import { buildDisplayToolsFromPlan } from './display-tools-builder.js';
import type { ToolCall } from './ai-stream.service.js';
import type { DisplayToolCall } from './display-tools/types.js';
import { DISPLAY_TOOL_NAMES } from './display-tools/types.js';
import { createLogger } from '../../infra/index.js';

const logger = createLogger('display-tool-guard');

/** Display tools whose card payloads must come from plan_data, not the LLM. */
export const PLAN_GROUNDED_DISPLAY_TOOLS = new Set([
  'show_itinerary',
  'show_budget_breakdown',
  'show_hotel_options',
  'show_activity_options',
  'show_flight_options',
  'show_ticket_options',
]);

function destinationMatchesPlan(plan: TripPlan, stated?: unknown): boolean {
  if (!plan.destination || typeof stated !== 'string' || stated.trim().length === 0) {
    return true;
  }
  const needle = stated.trim().toLowerCase();
  const slug = plan.destination.toLowerCase();
  const country = plan.country?.toLowerCase();
  return needle.includes(slug) || slug.includes(needle) || (country != null && needle.includes(country));
}

function validateInformationalDisplayTool(
  name: string,
  args: Record<string, unknown>,
  plan: TripPlan,
): boolean {
  if (name === 'show_visa_info') {
    return destinationMatchesPlan(plan, args.destination);
  }
  return true;
}

/**
 * Replace LLM display-tool arguments with server-built plan_data cards.
 * Drops calls that cannot be grounded in live inventory or curated listings.
 */
export function sanitizeDisplayToolCall(
  toolData: ToolCall,
  plan: TripPlan,
  pricing?: PricingService,
): DisplayToolCall | null {
  if (!DISPLAY_TOOL_NAMES.has(toolData.name)) return null;

  if (!PLAN_GROUNDED_DISPLAY_TOOLS.has(toolData.name)) {
    if (!validateInformationalDisplayTool(toolData.name, toolData.arguments, plan)) {
      logger.warn('Dropped display tool with destination mismatch', {
        tool: toolData.name,
        planDestination: plan.destination,
      });
      return null;
    }
    return { id: toolData.id, name: toolData.name, arguments: toolData.arguments };
  }

  const serverTool = buildDisplayToolsFromPlan(plan, pricing).find((t) => t.name === toolData.name);
  if (!serverTool) {
    logger.info('Dropped ungrounded display tool — no plan_data backing', { tool: toolData.name });
    return null;
  }

  return {
    id: toolData.id,
    name: toolData.name,
    arguments: serverTool.arguments,
  };
}
