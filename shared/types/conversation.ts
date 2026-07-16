/**
 * Shared conversation API types.
 */

import type { ToolCall } from './stream.js';

/** Tool call persisted on conversation_messages.tool_calls (JSONB). */
export interface StoredToolCall {
  id?: string;
  name: string;
  arguments?: Record<string, unknown>;
}

export interface ConversationMessageDto {
  id: string;
  role: string;
  content: string;
  tool_calls: ToolCall[];
  created_at: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  destination: string | null;
  status: string;
  updated_at: string;
  last_message: string | null;
  message_count: number;
}
