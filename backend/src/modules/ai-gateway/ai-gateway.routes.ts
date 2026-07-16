import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { createAIGatewayService } from './ai-gateway.service.js';
import type { UserPreferences } from './ai-gateway.service.js';
import {
  handleBrokerCardShortcut,
  injectBrokerSystemBlock,
  runStreamRoundtrip,
} from './ai-stream-handler.js';
import { writeSSE } from './broker-action.handler.js';
import { routeBrokerFlow } from './broker-flow.router.js';
import { parseTripIntentFromHistory } from './trip-intent.js';
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

  let clientDisconnected = false;
  req.on('close', () => { 
    if (!res.writableEnded) {
      clientDisconnected = true; 
    }
  });

  const userId = req.headers['x-user-id'] as string;
  const cacheKey = conversationId
    ? `ai:stream:${conversationId}:${createHash('sha256').update(message).digest('hex').slice(0, 16)}`
    : null;

  try {
    await pricingService.ensureRulesLoaded();

    if (conversationId) {
      await contextBuilder.assertConversationOwnership(conversationId, userId);
      await conversationService.appendMessage(conversationId, { role: 'user', content: message });
    }

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
  res.flushHeaders();
      conversationHistory = contextBuilder.contextToHistory(brokerCtx);
    } else if (Array.isArray(req.body.conversation_history)) {
      conversationHistory = req.body.conversation_history.filter(
        (entry: ChatMessage) =>
          entry.role
          && ['user', 'assistant', 'system'].includes(entry.role)
          && typeof entry.content === 'string',
      );
    }

    const tripIntent = parseTripIntentFromHistory(conversationHistory, message);
    let activePlan = emptyTripPlan();

    if (conversationId) {
      activePlan = await conversationService.getPlanData(conversationId);
    }

    if (tripIntent) {
      activePlan = await tripPlanService.ensureFreshPlan(activePlan, tripIntent);
      activePlan.customer_segment =
        (await contextBuilder.getTravelProfile(userId))?.customer_segment ?? 'b2c';

      if (conversationId) {
        await conversationService.savePlanData(conversationId, activePlan);
        if (tripIntent.destination) {
          await contextBuilder.upsertDestinationHint(userId, tripIntent.destination);
        }
      }

      const brokerAction = routeBrokerFlow(message, conversationHistory, activePlan);
      const handled = await handleBrokerCardShortcut({
        res,
        message,
        brokerAction,
        plan: activePlan,
        pricingService,
        conversationId,
        conversationService,
      });
  res.flushHeaders();
      if (handled) return;

      if (brokerAction.type === 'llm') {
        conversationHistory = injectBrokerSystemBlock(conversationHistory, tripPlanService, activePlan);
      }
    }

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
      tripIntent,
      userId,
      conversationId,
      clientDisconnected: () => req.destroyed || res.destroyed,
      tripPlanService,
      pricingService,
      curatedListings,
      conversationService,
      responseGuard,
    });
  res.flushHeaders();

    if (conversationId && events.length > 0) {
      await conversationService.appendMessage(conversationId, {
        role: 'assistant',
        content: assistantText || '(Responded with interactive cards)',
        tool_calls: events.filter((e) => e.type === 'tool_call').map((e) => e.data),
      });
  res.flushHeaders();
      await conversationService.compactRollingSummary(conversationId);
    }

    if (!hasBookingTools && hasDisplayTools && events.length > 0 && !(req.destroyed || res.destroyed) && cacheKey) {
      try {
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(events));
      } catch (err) {
        streamLogger.warn('Redis cache write failed', { error: (err as Error).message });
      }
    }
  } catch (error) {
    streamLogger.error('Stream handler error', { error: (error as Error).message });
    if (!(req.destroyed || res.destroyed)) {
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
