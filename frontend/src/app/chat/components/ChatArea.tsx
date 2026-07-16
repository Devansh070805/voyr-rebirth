"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  PiLightningFill,
  PiPaperPlaneRightFill,
  PiStopFill,
  PiImageFill,
  PiMicrophoneFill,
} from "react-icons/pi";
import type { ChatMessage } from "@/types/chat";
import ToolCallRenderer from "./ToolCallRenderer";
import MarkdownContent from "./MarkdownContent";
import ChatHeader from "./ChatHeader";
import MessageActions from "./MessageActions";
import StreamingCursor from "./StreamingCursor";
import ImagePreview from "./ImagePreview";
import ChatGuestBanner from "../../components/ChatGuestBanner";
import type { TripState, SelectedPlanIds } from "./chat-types";
import type { PlanSelectionItem, PlanSelectionType } from "@/types/plan-selection";

interface ChatAreaProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  suggestions: string[];
  onSendMessage: (message: string, imageUrl?: string) => void;
  onStopStreaming: () => void;
  onShare: () => void;
  onBook: () => void;
  onRegenerate: (messageId: string) => void;
  onPlanSelect?: (type: PlanSelectionType, item: PlanSelectionItem) => void;
  selectedPlanIds?: SelectedPlanIds;
  selectingPlanId?: string | null;
  planToast?: { message: string; type: "success" | "error" } | null;
  onDismissPlanToast?: () => void;
  tripState: TripState;
  conversationId: string | null;
  isAuthenticated: boolean;
  onRefreshConversations?: () => void;
  injectShowcaseCards?: () => void;
}

export default function ChatArea({
  messages,
  isStreaming,
  error,
  suggestions,
  onSendMessage,
  onStopStreaming,
  onShare,
  onBook,
  onRegenerate,
  onPlanSelect,
  selectedPlanIds,
  selectingPlanId,
  planToast,
  onDismissPlanToast,
  tripState,
  conversationId,
  isAuthenticated,
  onRefreshConversations,
  injectShowcaseCards,
}: ChatAreaProps) {
  const [inputValue, setInputValue] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (!isNearBottomRef.current) return;
    scrollAnchorRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [messages, isStreaming]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if ((!trimmed && !pendingImage) || isStreaming) return;
    onSendMessage(trimmed || "What is this place?", pendingImage || undefined);
    setInputValue("");
    setPendingImage(null);
    inputRef.current?.focus();
  }, [inputValue, pendingImage, isStreaming, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          setPendingImage(reader.result as string);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white">
      {!isAuthenticated && <ChatGuestBanner returnPath="/chat" />}
      <ChatHeader
        tripState={tripState}
        messages={messages}
        conversationId={conversationId}
        onShare={onShare}
        onBook={onBook}
        onTitleUpdated={() => onRefreshConversations?.()}
        onSaved={() => onRefreshConversations?.()}
      />

      {planToast && (
        <div
          className={`mx-8 mt-3 rounded-xl border px-4 py-2.5 text-sm font-semibold animate-toast-in ${
            planToast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="line-clamp-2">{planToast.message}</span>
            {onDismissPlanToast && (
              <button
                type="button"
                onClick={onDismissPlanToast}
                className="shrink-0 text-xs opacity-60 hover:opacity-100"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-8 py-6"
      >
        <div className="mx-auto max-w-[800px]">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "assistant" ? (
                <div className="group mb-6 flex gap-4 animate-slide-up-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-violet-600">
                    <PiLightningFill className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 max-w-[680px]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="text-[15px] leading-relaxed text-slate-700">
                        <MarkdownContent content={msg.content} />
                        {msg.isStreaming && !msg.content && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-400 [animation-delay:0.2s]" />
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-400 [animation-delay:0.4s]" />
                          </div>
                        )}
                        {msg.isStreaming && msg.content && <StreamingCursor />}
                      </div>

                      {/* Render tool call components (Generative UI) */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mt-2">
                          {msg.toolCalls.map((tc) => (
                            <ToolCallRenderer
                              key={tc.id}
                              toolCall={tc}
                              conversationId={conversationId}
                              onPlanSelect={onPlanSelect}
                              selectedPlanIds={selectedPlanIds}
                              selectingPlanId={selectingPlanId}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-between px-1">
                      <span className="text-xs text-slate-300" suppressHydrationWarning>{msg.timestamp}</span>
                      {!msg.isStreaming && (
                        <MessageActions
                          message={msg}
                          onRegenerate={() => onRegenerate(msg.id)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6 flex justify-end animate-slide-up-sm">
                  <div>
                    <div className="max-w-[600px] rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
                      {/* Image attachment */}
                      {msg.imageUrl && (
                        <div className="mb-3">
                          <img
                            src={msg.imageUrl}
                            alt="Attached"
                            className="max-h-48 rounded-lg border border-violet-200 object-cover"
                          />
                        </div>
                      )}
                      <p className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                    <div className="mt-1 px-1 text-right text-xs text-slate-300">
                      <span suppressHydrationWarning>{msg.timestamp}</span> <span className="ml-1 text-blue-400">✓✓</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Error display */}
          {error && (
            <div className="mb-6 flex justify-center animate-shake">
              <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">
                {error}
                <button
                  onClick={() =>
                    onSendMessage(
                      messages.filter((m) => m.role === "user").pop()?.content || "",
                    )
                  }
                  className="ml-3 font-semibold text-red-700 underline hover:text-red-800"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Suggestion buttons */}
          {suggestions.length > 0 && !isStreaming && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 animate-fade-in">
              {suggestions.map((btn, idx) => (
                <button
                  key={btn}
                  onClick={() => onSendMessage(btn)}
                  className="btn-press flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-600 shadow-sm transition-all duration-200 hover:border-violet-200 hover:bg-violet-50 hover:shadow-md hover:-translate-y-0.5 animate-slide-up-sm"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <PiLightningFill className="h-3.5 w-3.5" /> {btn}
                </button>
              ))}
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={scrollAnchorRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="px-8 pb-5">
        <div className="mx-auto max-w-[800px]">
          {/* Actions above input */}
          <div className="mb-3 flex justify-center gap-3 animate-fade-in">
            {isStreaming && (
              <button
                onClick={onStopStreaming}
                className="btn-press flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:shadow-md"
              >
                <PiStopFill className="h-3.5 w-3.5" /> Stop generating
              </button>
            )}
            {!isStreaming && injectShowcaseCards && (
              <button
                onClick={injectShowcaseCards}
                className="btn-press flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600 shadow-sm transition-all duration-200 hover:bg-emerald-100 hover:shadow-md"
              >
                <PiLightningFill className="h-3.5 w-3.5" /> Inject Showcase Cards
              </button>
            )}
          </div>

          {/* Image preview */}
          {pendingImage && (
            <div className="mb-2 px-5">
              <ImagePreview url={pendingImage} onRemove={() => setPendingImage(null)} />
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg shadow-slate-100">
            <div className="flex items-center gap-3">
              {/* Image upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 text-slate-300 hover:text-violet-500 transition-colors"
                title="Attach image"
              >
                <PiImageFill className="h-5 w-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              <input
                ref={inputRef}
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Plan a trip, ask about hotels, compare destinations..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={isStreaming}
                aria-label="Chat message input"
              />
              <PiMicrophoneFill className="h-5 w-5 shrink-0 text-slate-300" />
              <button
                onClick={handleSend}
                disabled={isStreaming || (!inputValue.trim() && !pendingImage)}
                className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-200 transition-all duration-200 disabled:opacity-40 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-300 hover:scale-105"
                aria-label="Send message"
              >
                <PiPaperPlaneRightFill className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-300">
            AI estimates are approximate. Verify details before booking.
          </p>
        </div>
      </div>
    </section>
  );
}
