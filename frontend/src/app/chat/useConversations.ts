"use client";

/**
 * useConversations — Conversation CRUD, persistence, and loading.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "../auth/context";
import type { ToolCallData, ChatMessage, ConversationListItem, ConversationMessageDto } from "@/types/chat";
import { WELCOME_INITIAL_CONTENT } from "./components/chat-types";

export interface UseConversationsReturn {
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  conversationHistoryRef: React.MutableRefObject<{ role: string; content: string }[]>;
  refreshConversations: () => Promise<void>;
  ensureConversation: () => Promise<string>;
  persistMessage: (conversationId: string, role: "user" | "assistant", content: string, toolCalls?: ToolCallData[]) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<ChatMessage[] | null>;
  setActiveConversationId: (id: string | null) => void;
  resetConversation: () => void;
  updateConversationHistory: (updater: (prev: { role: string; content: string }[]) => { role: string; content: string }[]) => void;
}

export function useConversations(): UseConversationsReturn {
  const { apiFetch } = useAuth();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationHistoryRef = useRef<{ role: string; content: string }[]>([
    {
      role: "assistant",
      content: WELCOME_INITIAL_CONTENT,
    },
  ]);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await apiFetch("/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
    }
  }, [apiFetch]);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (activeConversationId) return activeConversationId;
    try {
      const res = await apiFetch("/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Trip" }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveConversationId(data.id);
        return data.id;
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
    return "";
  }, [apiFetch, activeConversationId]);

  const persistMessage = useCallback(
    async (
      conversationId: string,
      role: "user" | "assistant",
      content: string,
      toolCalls?: ToolCallData[],
    ) => {
      if (!conversationId) return;
      try {
        await apiFetch(`/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, content, tool_calls: toolCalls || [] }),
        });
      } catch (err) {
        console.error("Failed to persist message:", err);
      }
    },
    [apiFetch],
  );

  const loadConversation = useCallback(
    async (conversationId: string): Promise<ChatMessage[] | null> => {
      try {
        const res = await apiFetch(`/conversations/${conversationId}/messages`);
        if (!res.ok) return null;

        const dbMessages = await res.json();
        const loaded: ChatMessage[] = (dbMessages as ConversationMessageDto[]).map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          toolCalls: m.tool_calls ?? [],
          isStreaming: false,
        }));

        conversationHistoryRef.current = loaded.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        return loaded;
      } catch (err) {
        console.error("Failed to load conversation:", err);
        return null;
      }
    },
    [apiFetch],
  );

  const resetConversation = useCallback(() => {
    setActiveConversationId(null);
    conversationHistoryRef.current = [
      {
        role: "assistant",
        content: WELCOME_INITIAL_CONTENT,
      },
    ];
  }, []);

  const updateConversationHistory = useCallback(
    (updater: (prev: { role: string; content: string }[]) => { role: string; content: string }[]) => {
      conversationHistoryRef.current = updater(conversationHistoryRef.current);
    },
    [],
  );

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  return {
    conversations,
    activeConversationId,
    conversationHistoryRef,
    refreshConversations,
    ensureConversation,
    persistMessage,
    loadConversation,
    setActiveConversationId,
    resetConversation,
    updateConversationHistory,
  };
}
