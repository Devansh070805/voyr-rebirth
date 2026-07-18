"use client";

/**
 * useStreamChat — SSE chat orchestrator (conversations, streaming, booking).
 */

import { useState, useCallback, useEffect } from "react";
import type { ToolCallData, ChatMessage, BookingState, ConversationListItem } from "@/types/chat";
import type { PlanSelectionItem, PlanSelectionType } from "@/types/plan-selection";
import { useAuth } from "../auth/context";
import { useConversations } from "./useConversations";
import { useStreamSSE, type SSEStreamCallbacks } from "./useStreamSSE";
import { useBooking } from "./useBooking";
import {
  EMPTY_PLAN_SELECTIONS,
  EMPTY_SELECTED_IDS,
  type PlanSelections,
  type SelectedPlanIds,
} from "./components/chat-types";
import { optionKey } from "./components/cards/option-utils";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi there! 👋\n\nI'm your **Voyr AI** travel assistant. Tell me about your dream trip — where you want to go, how long, your budget, what kind of experiences you're after — and I'll craft the perfect plan for you.\n\nOr just say hi and we'll figure it out together!",
  timestamp: new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }),
  toolCalls: [],
};

const DEFAULT_SUGGESTIONS = [
  "Plan a 5-night Bali trip for 2",
  "Suggest adventure destinations in Asia",
  "Help me plan a family trip to Europe",
  "Compare Bali vs Thailand vs Vietnam",
];

function formatTime(date?: string): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Pure function: compute the rollback state for message regeneration.
 * Returns new history and messages arrays without mutating the inputs.
 */
function computeRegenerationRollback(
  history: { role: string; content: string }[],
  messages: ChatMessage[],
  messageId: string,
  userMessage: string,
): { newHistory: { role: string; content: string }[]; newMessages: ChatMessage[] } {
  const newHistory = [...history];
  // Remove the last assistant response
  if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === "assistant") {
    newHistory.pop();
  }
  // Remove the user message that triggered it
  if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === "user") {
    newHistory.pop();
  }

  // Remove the target assistant message from display messages
  const newMessages = messages.filter((m) => m.id !== messageId);
  // Remove the corresponding user message too
  const userMsgIndex = [...newMessages].reverse().findIndex(
    (m) => m.role === "user" && m.content === userMessage,
  );
  if (userMsgIndex >= 0) {
    const actualIndex = newMessages.length - 1 - userMsgIndex;
    newMessages.splice(actualIndex, 1);
  }

  return { newHistory, newMessages };
}

interface UseStreamChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  suggestions: string[];
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  bookingState: BookingState;
  sendMessage: (message: string, imageUrl?: string) => Promise<void>;
  stopStreaming: () => void;
  clearError: () => void;
  resetChat: () => void;
  loadConversation: (conversationId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  startBooking: () => void;
  regenerateMessage: (messageId: string) => void;
  selectPlanItem: (type: PlanSelectionType, item: PlanSelectionItem) => Promise<void>;
  planSelections: PlanSelections;
  selectedPlanIds: SelectedPlanIds;
  selectingPlanId: string | null;
  planToast: { message: string; type: "success" | "error" } | null;
  clearPlanToast: () => void;
  authRequired: boolean;
  clearAuthRequired: () => void;
  injectShowcaseCards: () => void;
}

export function useStreamChat(): UseStreamChatReturn {
  const { isAuthenticated, apiFetch } = useAuth();
  const [authRequired, setAuthRequired] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [planSelections, setPlanSelections] = useState<PlanSelections>(EMPTY_PLAN_SELECTIONS);
  const [selectedPlanIds, setSelectedPlanIds] = useState<SelectedPlanIds>(EMPTY_SELECTED_IDS);
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null);
  const [planToast, setPlanToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  useEffect(() => {
    if (!planToast) return;
    const timer = setTimeout(() => setPlanToast(null), 4000);
    return () => clearTimeout(timer);
  }, [planToast]);

  const conv = useConversations();
  const sse = useStreamSSE();
  const booking = useBooking();

  const buildSSECallbacks = useCallback(
    (assistantId: string): SSEStreamCallbacks => {
      let fullText = "";
      const toolCalls: ToolCallData[] = [];

      return {
        onTextDelta: (text: string) => {
          fullText += text;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: fullText } : msg,
            ),
          );
        },
        onToolCall: (tc: ToolCallData) => {
          toolCalls.push(tc);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, toolCalls: [...toolCalls] } : msg,
            ),
          );
        },
        onToolResult: (event) => {
          booking.handleToolResult(event.data, toolCalls, assistantId, (tc) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, toolCalls: tc as ToolCallData[] } : msg,
              ),
            );
          });
        },
        onSuggestions: (newSuggestions: string[]) => {
          setSuggestions(newSuggestions);
        },
        onError: (_message: string) => {
          // Error is also set in useStreamSSE
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, isStreaming: false, timestamp: formatTime() }
                : msg,
            ),
          );
          // Note: backend already persists both user & assistant messages in ai-gateway.routes.ts
          // No need to call persistMessage here — doing so doubles every message in the DB.

          conv.updateConversationHistory((prev) => [
            ...prev,
            { role: "assistant", content: fullText || "(tool calls only)" },
          ]);

          conv.refreshConversations();
        },
      };
    },
    [conv, booking],
  );

  const sendMessage = useCallback(
    async (message: string, imageUrl?: string) => {
      if (!message.trim() || sse.isStreaming) return;

      if (!isAuthenticated) {
        setAuthRequired(true);
        return;
      }

      // Ensure conversation
      const convId = await conv.ensureConversation();

      // Build content
      let fullContent = message.trim();
      if (imageUrl) {
        fullContent = `[Image attached: ${imageUrl}]\n\n${fullContent}`;
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message.trim(),
        timestamp: formatTime(),
        imageUrl,
      };
      setMessages((prev) => [...prev, userMsg]);
      conv.updateConversationHistory((prev) => [
        ...prev,
        { role: "user", content: fullContent },
      ]);

      // Note: backend persists the user message in ai-gateway.routes.ts (appendMessage)
      // so we do NOT call conv.persistMessage here.

      const assistantId = `ai-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: formatTime(),
        toolCalls: [],
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setSuggestions([]);

      // Stream
      const callbacks = buildSSECallbacks(assistantId);
      await sse.sendMessage(
        fullContent,
        conv.conversationHistoryRef.current.slice(0, -1),
        callbacks,
        { conversationId: convId }
      );
    },
    [conv, sse, buildSSECallbacks, isAuthenticated],
  );

  const stopStreaming = useCallback(() => {
    sse.stopStreaming();
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.role === "assistant"
          ? { ...msg, isStreaming: false }
          : msg,
      ),
    );
    conv.updateConversationHistory((prev) => [
      ...prev,
      { role: "assistant", content: "(response stopped by user)" },
    ]);
  }, [sse, conv]);

  const clearError = sse.clearError;

  const resetChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setPlanSelections(EMPTY_PLAN_SELECTIONS);
    setSelectedPlanIds(EMPTY_SELECTED_IDS);
    setSelectingPlanId(null);
    setPlanToast(null);
    conv.resetConversation();
    booking.resetBooking();
  }, [conv, booking]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      const loaded = await conv.loadConversation(conversationId);
      if (loaded) {
        setMessages(loaded.length > 0 ? loaded : [WELCOME_MESSAGE]);
        conv.setActiveConversationId(conversationId);
        setSuggestions(DEFAULT_SUGGESTIONS);
        setPlanSelections(EMPTY_PLAN_SELECTIONS);
        setSelectedPlanIds(EMPTY_SELECTED_IDS);
        setSelectingPlanId(null);
        sse.clearError();
        booking.resetBooking();
      }
    },
    [conv, sse, booking],
  );

  const refreshConversations = conv.refreshConversations;

  const startBooking = useCallback(() => {
    if (!isAuthenticated) {
      setAuthRequired(true);
      return;
    }
    booking.startBooking(sendMessage);
  }, [booking, sendMessage, isAuthenticated]);

  const regenerateMessage = useCallback(
    (messageId: string) => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex <= 0) return;

      // Find the user message that preceded the target assistant message
      let userMessage = "";
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          userMessage = messages[i].content;
          break;
        }
      }
      if (!userMessage) return;

      // Pure computation: compute rollback state without mutation
      const { newHistory, newMessages } = computeRegenerationRollback(
        conv.conversationHistoryRef.current,
        messages,
        messageId,
        userMessage,
      );

      // Apply the computed state immutably
      conv.updateConversationHistory(() => newHistory);
      setMessages(newMessages);

      sendMessage(userMessage);
    },
    [messages, conv, sendMessage],
  );

  const selectPlanItem = useCallback(
    async (type: PlanSelectionType, item: PlanSelectionItem) => {
      console.log("[selectPlanItem] called", { type, isAuthenticated, convId: conv.activeConversationId });
      if (!isAuthenticated) {
        setPlanToast({ message: "Please log in to save items to your itinerary.", type: "error" });
        setAuthRequired(true);
        return;
      }
      const itemId = optionKey({
        listing_id: "listing_id" in item ? item.listing_id : undefined,
        route_id: "route_id" in item ? item.route_id : undefined,
        name: "name" in item ? item.name : undefined,
      });
      console.log("[selectPlanItem] itemId:", itemId);
      setSelectingPlanId(itemId);

      if ("source" in item && (item as any).source === "mock") {
        setTimeout(() => {
          setSelectedPlanIds((prev) => {
            if (type === "hotel") return { ...prev, hotel: itemId };
            if (type === "flight") return { ...prev, flight: itemId };
            if (type === "ticket") return { ...prev, ticket: itemId };
            if (type === "activity" && !prev.activities.includes(itemId)) {
              return { ...prev, activities: [...prev.activities, itemId] };
            }
            return prev;
          });

          setPlanSelections((prev) => {
            const name = type === "flight" && "label" in item ? item.label : "name" in item ? item.name : "Selected";
            if (type === "hotel") return { ...prev, hotel: { id: itemId, name } };
            if (type === "flight") return { ...prev, flight: { id: itemId, label: name } };
            if (type === "ticket") return { ...prev, ticket: { id: itemId, name } };
            if (type === "activity") {
              const exists = prev.activities.some((a) => a.id === itemId);
              if (exists) return prev;
              return { ...prev, activities: [...prev.activities, { id: itemId, name }] };
            }
            return prev;
          });

          const assistantMsg: ChatMessage = {
            id: `ai-plan-mock-${Date.now()}`,
            role: "assistant",
            content: `Awesome! I've added **${"name" in item ? item.name : "label" in item ? item.label : "the item"}** to your showcase plan. (Frontend Mock)`,
            timestamp: formatTime(),
            toolCalls: [],
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setPlanToast({ message: "Mock plan item selected!", type: "success" });
          setSelectingPlanId(null);
        }, 500);
        return;
      }

      const convId = conv.activeConversationId || (await conv.ensureConversation());
      if (!convId) {
        setPlanToast({ message: "Please start a conversation first before selecting items.", type: "error" });
        setSelectingPlanId(null);
        return;
      }
      try {
        const response = await apiFetch(`/conversations/${convId}/plan/select`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, item }),
        });
        if (!response.ok) {
          let errMsg = `Request failed (${response.status})`;
          try {
            const errBody = await response.json();
            errMsg =
              errBody?.error?.message ||
              errBody?.message ||
              (typeof errBody?.error === "string" ? errBody.error : null) ||
              errMsg;
          } catch { /* ignore JSON parse error */ }
          throw new Error(errMsg);
        }
        const data = (await response.json()) as {
          message: string;
          tool_calls: ToolCallData[];
        };

        setSelectedPlanIds((prev) => {
          if (type === "hotel") return { ...prev, hotel: itemId };
          if (type === "flight") return { ...prev, flight: itemId };
          if (type === "ticket") return { ...prev, ticket: itemId };
          if (type === "activity" && !prev.activities.includes(itemId)) {
            return { ...prev, activities: [...prev.activities, itemId] };
          }
          return prev;
        });

        setPlanSelections((prev) => {
          const name =
            type === "flight" && "label" in item
              ? item.label
              : "name" in item
                ? item.name
                : "Selected";
          if (type === "hotel") return { ...prev, hotel: { id: itemId, name } };
          if (type === "flight") {
            return { ...prev, flight: { id: itemId, label: name } };
          }
          if (type === "ticket") return { ...prev, ticket: { id: itemId, name } };
          if (type === "activity") {
            const exists = prev.activities.some((a) => a.id === itemId);
            if (exists) return prev;
            return { ...prev, activities: [...prev.activities, { id: itemId, name }] };
          }
          return prev;
        });

        const assistantMsg: ChatMessage = {
          id: `ai-plan-${Date.now()}`,
          role: "assistant",
          content: data.message,
          timestamp: formatTime(),
          toolCalls: data.tool_calls ?? [],
        };
        setMessages((prev) => [...prev, assistantMsg]);
        conv.updateConversationHistory((prev) => [
          ...prev,
          { role: "assistant", content: data.message },
        ]);
        setSuggestions([
          "Show flight routes",
          "Show ticket options",
          "Adjust my itinerary",
          "Update budget",
          "I am ready to book",
        ]);
        setPlanToast({ message: data.message, type: "success" });
      } catch (err: any) {
        console.error("Plan select error:", err);
        setPlanToast({ message: err.message || "Failed to add to itinerary.", type: "error" });
      } finally {
        setSelectingPlanId(null);
      }
    },
    [apiFetch, conv, isAuthenticated],
  );
  const injectShowcaseCards = useCallback(() => {
    const mockToolCalls: ToolCallData[] = [
      {
        id: "mock_hotels",
        name: "show_hotel_options",
        arguments: {
          destination: "Bali (Mock)",
          options: [
            {
              name: "Grand Mock Resort",
              price_per_night: 250,
              currency: "USD",
              category: "Luxury",
              rating: 5,
              location: "Ubud, Bali",
              hotel_id: 1234,
              source: "mock",
              featured: true
            },
            {
              name: "Sunny Beach Hotel",
              price_per_night: 80,
              currency: "USD",
              category: "Mid-Range",
              rating: 4,
              location: "Seminyak, Bali",
              hotel_id: 5678,
              source: "mock"
            }
          ]
        }
      },
      {
        id: "mock_activities",
        name: "show_activity_options",
        arguments: {
          destination: "Bali (Mock)",
          activities: [
            {
              name: "Mock Temple Tour",
              description: "Explore the ancient temples with a private guide",
              duration: "Half day",
              category: "Cultural",
              price: 45,
              currency: "USD",
              source: "mock",
              place_id: "place1",
              featured: true
            },
            {
              name: "Scuba Diving Basics",
              description: "Learn the basics of scuba diving in a safe environment",
              duration: "2-3 hours",
              category: "Adventure",
              price: 120,
              currency: "USD",
              source: "mock",
              place_id: "place2"
            }
          ]
        }
      },
      {
        id: "mock_flights",
        name: "show_flight_options",
        arguments: {
          destination: "Bali (Mock)",
          note: "Mock flight routes",
          options: [
            {
              route_id: "rt1",
              airline_iata: "GA",
              departure_iata: "JFK",
              arrival_iata: "DPS",
              label: "GA JFK → DPS",
              source: "mock",
              featured: true
            }
          ]
        }
      }
    ];

    const assistantMsg: ChatMessage = {
      id: `ai-mock-${Date.now()}`,
      role: "assistant",
      content: "Here are some **mock options** for showcasing, generated locally in the frontend!",
      timestamp: formatTime(),
      toolCalls: mockToolCalls,
    };
    
    setMessages((prev) => [...prev, assistantMsg]);
  }, []);

  return {
    messages,
    isStreaming: sse.isStreaming,
    error: sse.error,
    suggestions,
    conversations: conv.conversations,
    activeConversationId: conv.activeConversationId,
    bookingState: booking.bookingState,
    sendMessage,
    stopStreaming,
    clearError,
    resetChat,
    loadConversation,
    refreshConversations,
    startBooking,
    regenerateMessage,
    selectPlanItem,
    planSelections,
    selectedPlanIds,
    selectingPlanId,
    planToast,
    clearPlanToast: () => setPlanToast(null),
    authRequired,
    clearAuthRequired: () => setAuthRequired(false),
    injectShowcaseCards,
  };
}
