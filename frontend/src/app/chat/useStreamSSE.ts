"use client";

/**
 * useStreamSSE — SSE streaming connection for AI chat.
 *
 * Manages:
 * - Connection to POST /ai/stream with SSE parsing
 * - Streaming abort via AbortController
 * - Error state
 * - Text delta, tool call, and suggestion extraction from SSE events
 */

import { useState, useRef, useCallback } from "react";
import { useAuth } from "../auth/context";
import { iterSSEDataLines } from "./sse-utils";
import type { ToolCallData, StreamEvent } from "@/types/chat";

export interface SSEStreamCallbacks {
  onTextDelta: (text: string) => void;
  onToolCall: (tc: ToolCallData) => void;
  onToolResult: (result: StreamEvent & { type: "tool_result" }) => void;
  onSuggestions: (suggestions: string[]) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export interface UseStreamSSEReturn {
  isStreaming: boolean;
  error: string | null;
  sendMessage: (
    fullContent: string,
    conversationHistory: { role: string; content: string }[],
    callbacks: SSEStreamCallbacks,
    options?: { conversationId?: string; assistantId?: string },
  ) => Promise<void>;
  stopStreaming: () => void;
  clearError: () => void;
}

export function useStreamSSE(): UseStreamSSEReturn {
  const { apiFetch } = useAuth();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const sendMessage = useCallback(
    async (
      fullContent: string,
      conversationHistory: { role: string; content: string }[],
      callbacks: SSEStreamCallbacks,
      options?: { conversationId?: string; assistantId?: string },
    ): Promise<void> => {
      setError(null);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await apiFetch("/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: fullContent,
            conversation_history: conversationHistory,
            conversation_id: options?.conversationId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errMsg =
            errorData.message ||
            (errorData.error && errorData.error.message) ||
            `Request failed with status ${response.status}`;
          throw new Error(errMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();

        for await (const data of iterSSEDataLines(reader, decoder)) {
          try {
            const event: StreamEvent = JSON.parse(data);

            switch (event.type) {
              case "text_delta":
                callbacks.onTextDelta((event.data as { text: string }).text);
                break;

              case "tool_call":
                callbacks.onToolCall(event.data as ToolCallData);
                break;

              case "tool_result":
                callbacks.onToolResult(event as StreamEvent & { type: "tool_result" });
                break;

              case "suggestions":
                callbacks.onSuggestions(event.data as string[]);
                break;

              case "error":
                callbacks.onError((event.data as { message: string }).message);
                break;

              case "done":
                callbacks.onDone();
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again.";
          setError(errorMessage);
          callbacks.onError(errorMessage);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [apiFetch],
  );

  return {
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearError,
  };
}
