import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { createAIGatewayService } from './ai-gateway.service.js';
import type { UserPreferences } from './ai-gateway.service.js';
import { runStreamRoundtrip } from './ai-stream-handler.js';
import { writeSSE } from './broker-action.handler.js';
import { createLogger, redisClient, requireString, ValidationError } from '../../infra/index.js';
import type { ChatMessage } from '../conversation/chat.types.js';
import { createConversationService } from '../conversation/conversation.service.js';
import { createContextBuilderService } from '../conversation/context-builder.service.js';
import { createDefaultTripPlanModule } from '../trip-plan/trip-plan.factory.js';
import { emptyTripPlan } from '../trip-plan/trip-plan.types.js';
import { StreamingResponseGuard } from './streaming-response-guard.js';

const router = Router();
const aiGatewayService = createAIGatewayService();
const streamLogger = createLogger('ai-stream-route');
const conversationService = createConversationService();
const contextBuilder = createContextBuilderService();
const { tripPlanService, curatedListings, pricing: pricingService } = createDefaultTripPlanModule();

router.post('/stream', async (req: Request, res: Response, _next: NextFunction) => {
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'message is required' } });
    return;
  }

  const conversationId = req.body.conversation_id as string | undefined;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  // Immediately write a ping to open the chunked stream pipe
  res.write(': ping\n\n');

  const userId = req.headers['x-user-id'] as string;
  const cacheKey = conversationId
    ? `ai:stream:${conversationId}:${createHash('sha256').update(message).digest('hex').slice(0, 16)}`
    : null;

  try {
    // Pricing rules are optional — don't block stream if DB is unavailable
    try {
      await pricingService.ensureRulesLoaded();
    } catch (err) {
      streamLogger.warn('Could not load pricing rules, continuing without them', { error: (err as Error).message });
    }

    if (conversationId) {
      await contextBuilder.assertConversationOwnership(conversationId, userId);
      await conversationService.appendMessage(conversationId, { role: 'user', content: message });
    }

    // Build conversation history from DB or request body
    let conversationHistory: ChatMessage[] = [];
    if (conversationId) {
      const planForCtx = await conversationService.getPlanData(conversationId);
      const brokerCtx = await contextBuilder.buildBrokerContext({
        userId,
        userEmail: req.headers['x-user-email'] as string,
        conversationId,
        planSummary: tripPlanService.buildPlanSummary(planForCtx),
        plan: planForCtx,
      });
      conversationHistory = contextBuilder.contextToHistory(brokerCtx);
    } else if (Array.isArray(req.body.conversation_history)) {
      conversationHistory = req.body.conversation_history.filter(
        (entry: ChatMessage) =>
          entry.role
          && ['user', 'assistant', 'system'].includes(entry.role)
          && typeof entry.content === 'string',
      );
    }

    // Load persisted plan — no legacy supply fetch. Gemini calls search_hotels → Xotelo.
    const activePlan = conversationId
      ? await conversationService.getPlanData(conversationId)
      : emptyTripPlan();

    streamLogger.info('Starting Gemini stream roundtrip', { conversationId, hasHistory: conversationHistory.length });

    const responseGuard = new StreamingResponseGuard(activePlan);
    const {
      events,
      hasBookingTools,
      hasDisplayTools,
      assistantText,
    } = await runStreamRoundtrip({
      res,
      message,
      conversationHistory,
      activePlan,
      tripIntent: null, // Gemini handles intent detection via tool calls
      userId,
      conversationId,
      clientDisconnected: () => res.writableEnded || res.destroyed,
      tripPlanService,
      pricingService,
      curatedListings,
      conversationService,
      responseGuard,
    });

    streamLogger.info('Gemini stream roundtrip complete', { eventsCount: events.length, assistantTextLen: assistantText.length });

    if (conversationId && events.length > 0) {
      await conversationService.appendMessage(conversationId, {
        role: 'assistant',
        content: assistantText || '(Responded with interactive cards)',
        tool_calls: events.filter((e) => e.type === 'tool_call').map((e) => e.data),
      });
      await conversationService.compactRollingSummary(conversationId);
    }

    if (!hasBookingTools && hasDisplayTools && events.length > 0 && !res.destroyed && cacheKey) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(events));
      } catch (err) {
        streamLogger.warn('Redis cache write failed', { error: (err as Error).message });
      }
    }
  } catch (error) {
    streamLogger.error('Stream handler error', { error: (error as Error).message, stack: (error as Error).stack?.split('\n')[1] });
    if (!res.destroyed) {
      writeSSE(res, { type: 'error', data: { message: 'Internal server error' } });
      writeSSE(res, { type: 'done', data: {} });
    }
  } finally {
    res.end();
  }
});


router.post('/enrich', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destination = requireString(req.body.destination, 'destination');
    const enrichment = await aiGatewayService.enrichContent(destination);
    res.status(200).json({ enrichment });
  } catch (err) {
    next(err);
  }
});

router.post('/recommend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preferences = req.body.preferences as UserPreferences | undefined;
    if (!preferences || typeof preferences !== 'object') {
      throw new ValidationError('preferences is required and must be an object');
    }
    const recommendations = await aiGatewayService.getRecommendations(preferences);
    res.status(200).json({ recommendations });
  } catch (err) {
    next(err);
  }
});

export { router as aiGatewayRoutes };
