/**
 * Conversation Routes — Express router for conversation persistence.
 *
 * POST   /conversations              — Create a new conversation
 * GET    /conversations              — List user's conversations
 * GET    /conversations/:id          — Get a conversation
 * GET    /conversations/:id/messages — Get messages for a conversation
 * POST   /conversations/:id/messages — Append a message
 * PUT    /conversations/:id/title    — Update conversation title
 * POST   /conversations/:id/share    — Generate a share token
 * GET    /conversations/shared/:token — Get conversation by share token
 * DELETE /conversations/:id          — Soft-delete a conversation
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createConversationService } from './conversation.service.js';
import { ValidationError } from '../../infra/error-handler.js';
import { requireString } from '../../infra/index.js';
import { tripPlanRoutes } from '../trip-plan/trip-plan.routes.js';

const router = Router();
const conversationService = createConversationService();

/**
 * POST /conversations
 * Body: { title?: string }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireString(req.headers['x-user-id'] as string, 'x-user-id header');
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : undefined;

    const conversation = await conversationService.createConversation(userId, { title });
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /conversations
 * Query: ?limit=20
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireString(req.headers['x-user-id'] as string, 'x-user-id header');
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
    const archived = req.query.archived === 'true';

    const conversations = await conversationService.listConversations(userId, limit, archived);
    res.status(200).json(conversations);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /conversations/shared/:token
 * Public — no auth required (handled by share token)
 */
router.get('/shared/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = requireString(req.params.token, 'token');
    const conversation = await conversationService.getConversationByShareToken(token);
    const messages = await conversationService.getMessages(conversation.id);
    res.status(200).json({ conversation, messages });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /conversations/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = requireString(req.params.id, 'id');
    const conversation = await conversationService.getConversation(conversationId);
    res.status(200).json(conversation);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /conversations/:id/messages
 * Query: ?limit=100
 */
router.get('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = requireString(req.params.id, 'id');
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);

    const messages = await conversationService.getMessages(conversationId, limit);
    res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /conversations/:id/messages
 * Body: { role: string, content: string, tool_calls?: unknown[] }
 */
router.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = requireString(req.params.id, 'id');
    const role = requireString(req.body.role, 'role') as 'user' | 'assistant';
    if (!['user', 'assistant'].includes(role)) {
      throw new ValidationError('role must be "user" or "assistant"');
    }
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    const tool_calls = Array.isArray(req.body.tool_calls) ? req.body.tool_calls : [];

    const message = await conversationService.appendMessage(conversationId, {
      role,
      content,
      tool_calls,
    });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /conversations/:id/title
 * Body: { title: string }
 */
router.put('/:id/title', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = requireString(req.params.id, 'id');
    const title = requireString(req.body.title, 'title');

    await conversationService.updateTitle(conversationId, title);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /conversations/:id/share
 * Returns: { share_token: string, share_url: string }
 */
router.post('/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = requireString(req.params.id, 'id');
    const token = await conversationService.generateShareToken(conversationId);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.status(200).json({
      share_token: token,
      share_url: `${baseUrl}/chat/shared?token=${token}`,
    });
  } catch (err) {
    next(err);
  }
});

router.use('/:id/plan', tripPlanRoutes);

/**
 * DELETE /conversations/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationId = requireString(req.params.id, 'id');
    await conversationService.deleteConversation(conversationId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as conversationRoutes };
