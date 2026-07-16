/**
 * Chat types — shared wire/API types from @voyr/shared plus frontend UI state.
 */
export type {
  ToolCall as ToolCallData,
  StreamEvent,
  ToolResultData,
  ConversationListItem,
  ConversationMessageDto,
} from '@voyr/shared';

import type { ToolCall } from '@voyr/shared';

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  imageUrl?: string;
}

export interface BookingState {
  packageId: string | null;
  quoteId: string | null;
  finalAmount: number | null;
  validUntil: string | null;
  checkoutUrl: string | null;
  paymentId: string | null;
  status: "idle" | "package_created" | "quote_generated" | "checkout_ready" | "error";
  error: string | null;
}
