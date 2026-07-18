import type { Response } from 'express';
import type { ChatMessage } from '../conversation/chat.types.js';
import type { ConversationService } from '../conversation/conversation.service.js';
import type { CuratedListingsService } from '../curated-listings/curated-listings.service.js';
import type { PricingService } from '../pricing/pricing.service.js';
import type { TripPlanService } from '../trip-plan/trip-plan.service.js';
import type { TripPlan } from '../trip-plan/trip-plan.types.js';
import { streamChat } from './ai-stream.service.js';
import type { StreamEvent, ToolCall } from './ai-stream.service.js';
import { BOOKING_TOOLS, executeBookingTool } from './booking-tool-executor.js';
import {
  emitPlanCards,
  executeBrokerCardAction,
  planNeedsSupplyRefresh,
  writeSSE,
} from './broker-action.handler.js';
import { sanitizeDisplayToolCall } from './display-tool-guard.js';
import { DISPLAY_TOOL_NAMES, planDataGapMessage } from './display-tools-builder.js';
import { buildBrokerSystemBlock } from './system-prompt.js';
import type { TripIntent } from './trip-intent.js';
import type { BrokerFlowAction } from './broker-flow.router.js';
import { StreamingResponseGuard } from './streaming-response-guard.js';
import { createLogger } from '../../infra/index.js';
import { searchHotelsForDisplay } from '../xotelo/xotelo.service.js';

const logger = createLogger('ai-stream-handler');

export const DATA_TOOLS = new Set([
  'search_places',
  'search_web',
  'search_flights',
  'search_airports',
]);

// search_hotels is handled inline via Xotelo — not via the supply-refresh loop
export const HOTEL_SEARCH_TOOL = 'search_hotels';

const DATA_REFRESH_CONTINUATION =
  'Continue helping the traveler using the refreshed inventory above. '
  + 'Use display tools only when appropriate; do not invent prices or hotel names.';

function hasDisplayToolsInEvents(events: StreamEvent[]): boolean {
  return events.some(
    (event) => event.type === 'tool_call' && DISPLAY_TOOL_NAMES.has(event.data.name),
  );
}

export interface StreamRoundtripParams {
  res: Response;
  message: string;
  conversationHistory: ChatMessage[];
  activePlan: TripPlan;
  tripIntent: TripIntent | null;
  userId: string;
  conversationId?: string;
  clientDisconnected: () => boolean;
  tripPlanService: TripPlanService;
  pricingService: PricingService;
  curatedListings: CuratedListingsService;
  conversationService: ConversationService;
  responseGuard: StreamingResponseGuard;
}

export interface StreamRoundtripResult {
  events: StreamEvent[];
  hasBookingTools: boolean;
  hasDisplayTools: boolean;
  plan: TripPlan;
  assistantText: string;
}

interface StreamRoundState {
  pendingDataTools: ToolCall[];
  streamComplete: boolean;
  events: StreamEvent[];
  hasBookingTools: boolean;
  hasDisplayTools: boolean;
  pendingDone: StreamEvent | null;
  roundAssistantText: string;
}

async function executeStreamRound(
  params: StreamRoundtripParams,
  workingPlan: TripPlan,
  message: string,
  conversationHistory: ChatMessage[],
): Promise<StreamRoundState> {
  const pendingDataTools: StreamRoundState['pendingDataTools'] = [];
  const events: StreamEvent[] = [];
  let streamComplete = false;
  let hasBookingTools = false;
  let hasDisplayTools = false;
  let pendingDone: StreamEvent | null = null;
  const roundTextStart = params.responseGuard.finalText();

  function interceptSSE(event: StreamEvent) {
    if (event.type === 'tool_call') {
      if (BOOKING_TOOLS.has(event.data.name)) hasBookingTools = true;
      if (DISPLAY_TOOL_NAMES.has(event.data.name)) hasDisplayTools = true;
    }

    if (event.type === 'text_delta') {
      const chunk = event.data.text;
      const guardedChunk = params.responseGuard.append(chunk);
      logger.info('interceptSSE text_delta', { chunkLen: chunk.length, guardedLen: guardedChunk.length, writableEnded: params.res.writableEnded });
      if (!guardedChunk) return;
      const guardedEvent: StreamEvent = { type: 'text_delta', data: { text: guardedChunk } };
      events.push(guardedEvent);
      writeSSE(params.res, guardedEvent);
      return;
    }

    logger.info('interceptSSE non-text event', { type: event.type });
    events.push(event);
    writeSSE(params.res, event);
  }

  await streamChat(message, conversationHistory, async (event: StreamEvent) => {
    if (params.clientDisconnected()) {
      logger.warn('clientDisconnected is TRUE, dropping event', { eventType: event.type });
      return;
    }

    if (event.type === 'tool_call') {
      const toolData = event.data;

      if (toolData.name === HOTEL_SEARCH_TOOL) {
        logger.info('Executing hotel search via Xotelo', { args: toolData.arguments });
        try {
          const args = toolData.arguments as Record<string, unknown>;
          const hotels = await searchHotelsForDisplay({
            destination: (args.destination as string) || '',
            checkin: args.checkin as string | undefined,
            checkout: args.checkout as string | undefined,
            adults: (args.adults as number) || 2,
            rooms: (args.rooms as number) || 1,
            currency: (args.cur as string) || 'USD',
            limit: 8,
          });

          if (hotels.length > 0) {
            // Directly emit the hotel options card without another AI round
            const hotelCardEvent: StreamEvent = {
              type: 'tool_call',
              data: {
                id: `xotelo_hotels_${Date.now()}`,
                name: 'show_hotel_options',
                arguments: {
                  destination: args.destination,
                  options: hotels.map((h) => ({
                    name: h.name,
                    category: h.category,
                    price_per_night: h.price_per_night,
                    currency: h.currency,
                    rating: h.rating || 4,
                    highlights: h.highlights.length > 0 ? h.highlights : ['Great location', 'Popular choice'],
                    location: h.location,
                    hotel_key: h.hotel_key,
                    image: h.image,
                    url: h.url,
                    rates: h.rates,
                  })),
                },
              },
            };
            hasDisplayTools = true;
            interceptSSE(hotelCardEvent);
          } else {
            // No results — tell Gemini so it can respond gracefully
            const noResultText: StreamEvent = {
              type: 'text_delta',
              data: { text: `I wasn't able to find hotels in **${args.destination}** right now. Please try a slightly different destination name or check back shortly.` },
            };
            interceptSSE(noResultText);
          }
        } catch (err) {
          logger.error('Xotelo hotel search failed', { error: (err as Error).message });
        }
        return;
      }

      if (DATA_TOOLS.has(toolData.name)) {
        pendingDataTools.push(toolData);
        logger.info('Data tool requested, will refresh plan via supply registry', { tool: toolData.name });
        return;
      }

      if (DISPLAY_TOOL_NAMES.has(toolData.name)) {
        const sanitized = sanitizeDisplayToolCall(toolData, workingPlan, params.pricingService);
        if (!sanitized) return;
        interceptSSE({ type: 'tool_call', data: sanitized });
        return;
      }

      if (BOOKING_TOOLS.has(toolData.name)) {
        interceptSSE(event);
        const result = await executeBookingTool(
          params.userId,
          params.conversationId,
          toolData.name,
          toolData.arguments,
          workingPlan,
          params.curatedListings,
        );
        interceptSSE({
          type: 'tool_result',
          data: {
            tool_call_id: toolData.id,
            tool_name: toolData.name,
            success: result.success,
            data: result.data,
          },
        });
        return;
      }

    }

    if (event.type === 'done') {
      streamComplete = true;
      pendingDone = event;
      return;
    }

    interceptSSE(event);
  });

  const roundAssistantText = params.responseGuard.finalText().slice(roundTextStart.length);

  return {
    pendingDataTools,
    streamComplete,
    events,
    hasBookingTools,
    hasDisplayTools,
    pendingDone,
    roundAssistantText,
  };
}

export async function runStreamRoundtrip(
  params: StreamRoundtripParams,
  maxRounds = 2,
): Promise<StreamRoundtripResult> {
  if (maxRounds <= 0) {
    return {
      events: [],
      hasBookingTools: false,
      hasDisplayTools: false,
      plan: params.activePlan,
      assistantText: '',
    };
  }

  let workingPlan = params.activePlan;
  let conversationHistory = params.conversationHistory;
  let userMessage = params.message;

  const emittedEvents: StreamEvent[] = [];
  let hasBookingTools = false;
  let hasDisplayTools = false;
  let pendingDone: StreamEvent | null = null;

  for (let round = 0; round < maxRounds; round += 1) {
    const isLastRound = round === maxRounds - 1;
    const roundResult = await executeStreamRound(params, workingPlan, userMessage, conversationHistory);

    emittedEvents.push(...roundResult.events);
    hasBookingTools = hasBookingTools || roundResult.hasBookingTools;
    hasDisplayTools = hasDisplayTools || roundResult.hasDisplayTools;
    pendingDone = roundResult.pendingDone ?? pendingDone;

    if (params.clientDisconnected()) {
      return {
        events: emittedEvents,
        hasBookingTools,
        hasDisplayTools,
        plan: workingPlan,
        assistantText: params.responseGuard.finalText(),
      };
    }

    const needsSupplyRefresh = roundResult.pendingDataTools.length > 0
      && roundResult.streamComplete
      && workingPlan.destination
      && planNeedsSupplyRefresh(roundResult.pendingDataTools.map((t) => t.name));

    const willContinue = !isLastRound && needsSupplyRefresh;

    if (willContinue) {
      workingPlan = await params.tripPlanService.fetchLiveData(workingPlan);
      const toolNames = roundResult.pendingDataTools.map((t) => t.name).join(', ');
      conversationHistory = [
        ...conversationHistory,
        ...(roundResult.roundAssistantText
          ? [{ role: 'assistant' as const, content: roundResult.roundAssistantText }]
          : []),
        {
          role: 'system',
          content:
            `Live supply refreshed (${toolNames}). Use this inventory only — do not invent prices or names.\n\n`
            + params.tripPlanService.buildPlanSummary(workingPlan),
        },
      ];
      userMessage = DATA_REFRESH_CONTINUATION;
      pendingDone = null;
      continue;
    }

    if (needsSupplyRefresh) {
      workingPlan = await params.tripPlanService.fetchLiveData(workingPlan);
    }
    break;
  }

  if (params.tripIntent && !hasDisplayTools && !hasDisplayToolsInEvents(emittedEvents)) {
    hasDisplayTools = emitPlanCards(workingPlan, (event) => {
      emittedEvents.push(event);
      writeSSE(params.res, event);
    }, params.pricingService, 'full');
    const gap = planDataGapMessage(workingPlan);
    if (gap) {
      const gapEvent: StreamEvent = { type: 'text_delta', data: { text: gap } };
      emittedEvents.push(gapEvent);
      writeSSE(params.res, gapEvent);
      params.responseGuard.append(gap);
    }
  }

  if (pendingDone) {
    emittedEvents.push(pendingDone);
    writeSSE(params.res, pendingDone);
  }

  if (params.conversationId) {
    await params.conversationService.savePlanData(params.conversationId, workingPlan);
  }

  return {
    events: emittedEvents,
    hasBookingTools,
    hasDisplayTools,
    plan: workingPlan,
    assistantText: params.responseGuard.finalText(),
  };
}

export async function handleBrokerCardShortcut(params: {
  res: Response;
  message: string;
  brokerAction: BrokerFlowAction;
  plan: TripPlan;
  pricingService: PricingService;
  conversationId?: string;
  conversationService: ConversationService;
}): Promise<boolean> {
  const events: StreamEvent[] = [];
  const write = (event: StreamEvent) => {
    events.push(event);
    writeSSE(params.res, event);
  };

  const cardResult = await executeBrokerCardAction({
    action: params.brokerAction,
    message: params.message,
    plan: params.plan,
    pricing: params.pricingService,
    write,
  });

  if (!cardResult.handled) return false;

  write({ type: 'done', data: {} });

  if (params.conversationId && cardResult.introText) {
    await params.conversationService.appendMessage(params.conversationId, {
      role: 'assistant',
      content: cardResult.introText,
      tool_calls: events.filter((e) => e.type === 'tool_call').map((e) => e.data),
    });
    await params.conversationService.compactRollingSummary(params.conversationId);
  }

  return true;
}

export function injectBrokerSystemBlock(
  history: ChatMessage[],
  tripPlanService: TripPlanService,
  plan: TripPlan,
): ChatMessage[] {
  return [
    ...history,
    {
      role: 'system',
      content: buildBrokerSystemBlock({
        planSummary: tripPlanService.buildPlanSummary(plan),
        bookingStage: 'planning',
      }),
    },
  ];
}
