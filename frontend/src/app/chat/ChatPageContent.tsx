"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PiMapTrifoldFill } from "react-icons/pi";
import AppShell from "../components/AppShell";
import type { SidebarConversation } from "../components/AppShell";
import LoginPromptModal from "../components/LoginPromptModal";
import { useAuth } from "../auth/context";
import { useStreamChat } from "./useStreamChat";
import { useApi } from "../auth/context";
import ChatArea from "./components/ChatArea";
import RightPanel from "./components/RightPanel";
import MobilePlanSheet from "./components/MobilePlanSheet";
import { extractTripState } from "./components/chat-types";

export function ChatPageContent({ variant = "consumer" }: { variant?: "consumer" | "partner" }) {
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { apiFetch } = useApi();
  const [mobilePlanOpen, setMobilePlanOpen] = useState(false);
  const {
    messages,
    isStreaming,
    error,
    suggestions,
    conversations,
    activeConversationId,
    bookingState,
    sendMessage,
    stopStreaming,
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
    clearPlanToast,
    authRequired,
    clearAuthRequired,
    injectShowcaseCards,
  } = useStreamChat();

  const returnPath =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : variant === "partner" ? "/partner/chat" : "/chat";

  const autoSentRef = useRef(false);
  useEffect(() => {
    const prefillMessage = searchParams.get("message");
    if (prefillMessage && !autoSentRef.current && !isStreaming && isAuthenticated) {
      autoSentRef.current = true;
      const timer = setTimeout(() => sendMessage(prefillMessage), 300);
      return () => clearTimeout(timer);
    }
  }, [searchParams, sendMessage, isStreaming, isAuthenticated]);

  const loadedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && idParam !== loadedIdRef.current) {
      loadedIdRef.current = idParam;
      loadConversation(idParam);
    }
  }, [searchParams, loadConversation]);

  const tripState = extractTripState(messages);

  const sidebarConversations: SidebarConversation[] = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    destination: c.destination,
    updated_at: c.updated_at,
  }));

  const handleShare = useCallback(async () => {
    const fallbackCopy = () => {
      navigator.clipboard.writeText(window.location.href).catch((e) => console.error("Clipboard write failed:", e));
    };

    if (!activeConversationId) {
      fallbackCopy();
      return;
    }
    try {
      const res = await apiFetch(`/conversations/${activeConversationId}/share`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        navigator.clipboard.writeText(data.share_url).catch((e) => console.error("Clipboard write failed:", e));
      } else {
        fallbackCopy();
      }
    } catch (err) {
      console.error("Share link generation failed:", err);
      fallbackCopy();
    }
  }, [activeConversationId, apiFetch]);

  const hasPlanContent = !!tripState.destination;

  return (
    <AppShell
      activePage="Chat"
      conversations={sidebarConversations}
      activeConversationId={activeConversationId}
      onConversationClick={loadConversation}
      onNewChat={resetChat}
    >
      <div className="relative flex h-full">
        <ChatArea
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          suggestions={suggestions}
          onSendMessage={sendMessage}
          onStopStreaming={stopStreaming}
          onShare={handleShare}
          onBook={startBooking}
          onRegenerate={regenerateMessage}
          onPlanSelect={selectPlanItem}
          selectedPlanIds={selectedPlanIds}
          selectingPlanId={selectingPlanId}
          planToast={planToast}
          onDismissPlanToast={clearPlanToast}
          tripState={tripState}
          conversationId={activeConversationId}
          isAuthenticated={isAuthenticated}
          onRefreshConversations={refreshConversations}
          injectShowcaseCards={injectShowcaseCards}
        />
        <RightPanel
          tripState={tripState}
          bookingState={bookingState}
          planSelections={planSelections}
        />

        {hasPlanContent && (
          <button
            type="button"
            onClick={() => setMobilePlanOpen(true)}
            className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-300 animate-scale-in lg:hidden"
          >
            <PiMapTrifoldFill className="h-4 w-4" />
            Plan
          </button>
        )}

        <MobilePlanSheet
          open={mobilePlanOpen}
          onClose={() => setMobilePlanOpen(false)}
          tripState={tripState}
          bookingState={bookingState}
          planSelections={planSelections}
        />
      </div>
      <LoginPromptModal
        open={authRequired}
        onClose={clearAuthRequired}
        returnPath={returnPath}
      />
    </AppShell>
  );
}
