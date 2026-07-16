/** Shared chat message types — used by conversation, AI gateway, and context builder. */

export type { StoredToolCall, ConversationMessageDto as ConversationMessageRow } from '@voyr/shared';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
