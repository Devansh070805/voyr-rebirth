/**
 * Conversation Service — Persistent chat storage scoped to a user,
 * optionally linked to a package for the booking flow.
 */

import crypto from 'node:crypto';
import { queryRows, queryOne, query } from '../../db/index.js';
import { createLogger, NotFoundError } from '../../infra/index.js';
import type { StoredToolCall } from './chat.types.js';
import type { TripPlan } from '../trip-plan/trip-plan.types.js';
import { parseTripPlan, serializeTripPlan } from '../trip-plan/trip-plan.parse.js';

const logger = createLogger('conversation-service');


export interface Conversation {
  id: string;
  user_id: string;
  package_id: string | null;
  title: string;
  destination: string | null;
  status: string;
  share_token: string | null;
  plan_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls: StoredToolCall[];
  created_at: string;
}

export interface CreateConversationRequest {
  title?: string;
}

export interface AppendMessageRequest {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: StoredToolCall[];
}

import type { ConversationListItem } from '@voyr/shared';

export type { ConversationListItem };

export interface ConversationService {
  createConversation(userId: string, data?: CreateConversationRequest): Promise<Conversation>;
  listConversations(userId: string, limit?: number, archived?: boolean): Promise<ConversationListItem[]>;
  getConversation(conversationId: string): Promise<Conversation>;
  getMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]>;
  getMessageCount(conversationId: string, role?: string): Promise<number>;
  appendMessage(conversationId: string, data: AppendMessageRequest): Promise<ConversationMessage>;
  updateTitle(conversationId: string, title: string): Promise<void>;
  updateDestination(conversationId: string, destination: string): Promise<void>;
  updateStatus(conversationId: string, status: string): Promise<void>;
  linkPackage(conversationId: string, packageId: string): Promise<void>;
  generateShareToken(conversationId: string): Promise<string>;
  getConversationByShareToken(token: string): Promise<Conversation>;
  deleteConversation(conversationId: string): Promise<void>;
  getPlanData(conversationId: string): Promise<TripPlan>;
  savePlanData(conversationId: string, plan: TripPlan): Promise<void>;
  compactRollingSummary(conversationId: string): Promise<void>;
}


export function createConversationService(): ConversationService {
  return {
    async createConversation(userId: string, data?: CreateConversationRequest): Promise<Conversation> {
      const title = data?.title || 'New Trip';

      const conversation = await queryOne<Conversation>(
        `INSERT INTO conversations (user_id, title)
         VALUES ($1, $2)
         RETURNING *`,
        [userId, title],
      );

      logger.info('Conversation created', { conversationId: conversation!.id, userId });
      return conversation!;
    },

    async listConversations(userId: string, limit = 20, archived = false): Promise<ConversationListItem[]> {
      const timeFilter = archived
        ? `c.updated_at < NOW() - INTERVAL '30 days'`
        : `c.updated_at >= NOW() - INTERVAL '30 days'`;

      return queryRows<ConversationListItem>(
        `SELECT
           c.id,
           c.title,
           c.destination,
           c.status,
           c.updated_at,
           (SELECT content FROM conversation_messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC LIMIT 1) AS last_message,
           (SELECT COUNT(*)::int FROM conversation_messages
            WHERE conversation_id = c.id) AS message_count
         FROM conversations c
         WHERE c.user_id = $1 AND c.status != 'deleted' AND ${timeFilter}
         ORDER BY c.updated_at DESC
         LIMIT $2`,
        [userId, limit],
      );
    },

    async getConversation(conversationId: string): Promise<Conversation> {
      const conversation = await queryOne<Conversation>(
        `SELECT * FROM conversations WHERE id = $1`,
        [conversationId],
      );
      if (!conversation) {
        throw new NotFoundError(`Conversation ${conversationId} not found`);
      }
      return conversation;
    },

    async getMessages(conversationId: string, limit = 100): Promise<ConversationMessage[]> {
      return queryRows<ConversationMessage>(
        `SELECT * FROM conversation_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC
         LIMIT $2`,
        [conversationId, limit],
      );
    },

    async getMessageCount(conversationId: string, role?: string): Promise<number> {
      let queryStr = `SELECT COUNT(*)::int as count FROM conversation_messages WHERE conversation_id = $1`;
      const params: (string | number)[] = [conversationId];
      if (role) {
        queryStr += ` AND role = $2`;
        params.push(role);
      }
      const result = await queryOne<{ count: number }>(queryStr, params);
      return result?.count || 0;
    },

    async appendMessage(conversationId: string, data: AppendMessageRequest): Promise<ConversationMessage> {
      const toolCalls = data.tool_calls || [];

      const message = await queryOne<ConversationMessage>(
        `INSERT INTO conversation_messages (conversation_id, role, content, tool_calls)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [conversationId, data.role, data.content, JSON.stringify(toolCalls)],
      );

      // Auto-update destination from tool calls
      for (const tc of toolCalls) {
        if (tc.name === 'show_itinerary' && typeof tc.arguments?.destination === 'string') {
          const dest = tc.arguments.destination;
          await query(
            `UPDATE conversations SET destination = $1, title = $2 WHERE id = $3`,
            [dest, `${dest} Trip`, conversationId],
          );
        }
      }

      return message!;
    },

    async updateTitle(conversationId: string, title: string): Promise<void> {
      await query(
        `UPDATE conversations SET title = $1, updated_at = now() WHERE id = $2`,
        [title, conversationId],
      );
    },

    async updateDestination(conversationId: string, destination: string): Promise<void> {
      await query(
        `UPDATE conversations SET destination = $1, updated_at = now() WHERE id = $2`,
        [destination, conversationId],
      );
    },

    async updateStatus(conversationId: string, status: string): Promise<void> {
      await query(
        `UPDATE conversations SET status = $1, updated_at = now() WHERE id = $2`,
        [status, conversationId],
      );
    },

    async linkPackage(conversationId: string, packageId: string): Promise<void> {
      await query(
        `UPDATE conversations SET package_id = $1, updated_at = now() WHERE id = $2`,
        [packageId, conversationId],
      );
    },

    async generateShareToken(conversationId: string): Promise<string> {
      const token = crypto.randomBytes(16).toString('hex');
      await query(
        `UPDATE conversations SET share_token = $1, updated_at = now() WHERE id = $2`,
        [token, conversationId],
      );
      logger.info('Share token generated', { conversationId });
      return token;
    },

    async getConversationByShareToken(token: string): Promise<Conversation> {
      const conversation = await queryOne<Conversation>(
        `SELECT * FROM conversations WHERE share_token = $1`,
        [token],
      );
      if (!conversation) {
        throw new NotFoundError('Shared conversation not found');
      }
      return conversation;
    },

    async deleteConversation(conversationId: string): Promise<void> {
      await query(
        `UPDATE conversations SET status = 'deleted', updated_at = now() WHERE id = $1`,
        [conversationId],
      );
      logger.info('Conversation deleted', { conversationId });
    },

    async getPlanData(conversationId: string): Promise<TripPlan> {
      const row = await queryOne<{ plan_data: Record<string, unknown> | null }>(
        `SELECT plan_data FROM conversations WHERE id = $1`,
        [conversationId],
      );
      return parseTripPlan(row?.plan_data ?? {});
    },

    async savePlanData(conversationId: string, plan: TripPlan): Promise<void> {
      await query(
        `UPDATE conversations SET plan_data = $1, updated_at = now() WHERE id = $2`,
        [JSON.stringify(serializeTripPlan(plan)), conversationId],
      );
    },

    async compactRollingSummary(conversationId: string): Promise<void> {
      const count = await this.getMessageCount(conversationId);
      if (count <= 24) return;

      const oldest = await queryRows<{ id: string; role: string; content: string }>(
        `SELECT id, role, content FROM conversation_messages
         WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 8`,
        [conversationId],
      );
      if (oldest.length === 0) return;

      const chunk = oldest
        .map((m) => `${m.role}: ${m.content.replace(/\s+/g, ' ').slice(0, 160)}`)
        .join('\n');

      await query(
        `UPDATE conversations SET
          rolling_summary = trim(both E'\\n' from concat(COALESCE(rolling_summary, ''), E'\\n', $1)),
          updated_at = now()
         WHERE id = $2`,
        [chunk, conversationId],
      );

      const ids = oldest.map((m) => m.id);
      await query(
        `DELETE FROM conversation_messages WHERE id = ANY($1::uuid[])`,
        [ids],
      );
    },
  };
}
