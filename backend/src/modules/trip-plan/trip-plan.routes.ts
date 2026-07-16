import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createConversationService } from '../conversation/conversation.service.js';
import { createContextBuilderService } from '../conversation/context-builder.service.js';
import { requireString } from '../../infra/validation.js';
import { ValidationError } from '../../infra/error-handler.js';
import { buildDisplayToolsFromPlan } from '../ai-gateway/display-tools-builder.js';
import { createDefaultTripPlanModule } from './trip-plan.factory.js';
import { parsePlanSelection } from './plan-selection.js';

const router = Router({ mergeParams: true });
const conversationService = createConversationService();
const contextBuilder = createContextBuilderService();
const { tripPlanService, pricing } = createDefaultTripPlanModule();

/**
 * GET /conversations/:id/plan
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = requireString(req.params.id, 'id');
    const userId = requireString(req.headers['x-user-id'] as string, 'x-user-id header');
    await contextBuilder.assertConversationOwnership(conversationId, userId);
    const plan = await conversationService.getPlanData(conversationId);
    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /conversations/:id/plan/select
 */
router.post('/select', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = requireString(req.params.id, 'id');
    const userId = requireString(req.headers['x-user-id'] as string, 'x-user-id header');
    await contextBuilder.assertConversationOwnership(conversationId, userId);

    const selection = parsePlanSelection(req.body);

    let plan = await conversationService.getPlanData(conversationId);
    if (!plan.destination) {
      throw new ValidationError('No active trip plan for this conversation yet');
    }

    plan = tripPlanService.applySelection(plan, selection);
    plan = await tripPlanService.ensureFreshPlan(plan);
    await conversationService.savePlanData(conversationId, plan);

    const message = tripPlanService.selectionConfirmationMessage(plan, selection);
    const tool_calls = buildDisplayToolsFromPlan(plan, pricing);

    const assistantMessage = await conversationService.appendMessage(conversationId, {
      role: 'assistant',
      content: message,
      tool_calls,
    });

    res.status(200).json({
      plan,
      message,
      tool_calls,
      assistant_message: assistantMessage,
    });
  } catch (err) {
    next(err);
  }
});

export { router as tripPlanRoutes };
