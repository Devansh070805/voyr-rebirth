"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  PiLightningFill,
  PiPaperPlaneRightFill,
  PiMapPinFill,
  PiShareFatFill,
} from "react-icons/pi";
import Link from "next/link";
import MarkdownContent from "../components/MarkdownContent";
import ToolCallRenderer from "../components/ToolCallRenderer";
import type { ToolCallData } from "@/types/chat";

interface SharedMessage {
  id: string;
  role: string;
  content: string;
  tool_calls: ToolCallData[];
  created_at: string;
}

interface SharedConversation {
  id: string;
  title: string;
  destination: string | null;
  created_at: string;
}

function SharedConversationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [conversation, setConversation] = useState<SharedConversation | null>(null);
  const [messages, setMessages] = useState<SharedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        setError("No shared trip token provided");
        setLoading(false);
        return;
      }
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
        const res = await fetch(`${apiBaseUrl}/conversations/shared/${token}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Shared trip not found" : "Failed to load");
        }
        const data = await res.json();
        setConversation(data.conversation);
        setMessages(data.messages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load shared trip");
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
            <PiLightningFill className="h-6 w-6 animate-pulse text-violet-500" />
          </div>
          <p className="mt-4 text-sm text-slate-500">Loading shared trip...</p>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <PiMapPinFill className="h-8 w-8 text-red-300" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-700">{error || "Trip not found"}</h2>
          <p className="mt-2 text-sm text-slate-400">
            This shared link may have expired or been removed.
          </p>
          <a
            href="/chat"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <img src="/images/Voyr-logo.png" alt="Voyr" className="h-5 w-auto" /> Plan Your Own Trip
          </a>
        </div>
      </div>
    );
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex h-[64px] items-center justify-between border-b border-slate-200 bg-white px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white">
              <PiPaperPlaneRightFill className="h-3.5 w-3.5" />
            </div>
            <span className="text-base font-bold text-slate-900">Voyr</span>
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <PiMapPinFill className="h-4 w-4 text-violet-500" />
            <span className="font-semibold text-slate-700">{conversation.title}</span>
          </div>
        </div>
        <a
          href="/chat"
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700"
        >
          <PiPaperPlaneRightFill className="h-3.5 w-3.5" /> Plan Your Own Trip
        </a>
      </header>

      {/* Shared badge */}
      <div className="flex items-center justify-center gap-2 border-b border-slate-100 bg-violet-50 px-8 py-2 text-center text-xs font-medium text-violet-600">
        <PiShareFatFill className="h-3.5 w-3.5 shrink-0" />
        <span>You&apos;re viewing a shared trip plan</span>
        {conversation.destination && <span>— {conversation.destination}</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-[800px]">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "assistant" ? (
                <div className="mb-6 flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-violet-600">
                    <PiLightningFill className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 max-w-[680px]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="text-[15px] leading-relaxed text-slate-700">
                        <MarkdownContent content={msg.content} />
                      </div>
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="mt-2">
                          {msg.tool_calls.map((tc) => (
                            <ToolCallRenderer key={tc.id} toolCall={tc} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-1 px-1 text-xs text-slate-300">
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6 flex justify-end">
                  <div>
                    <div className="max-w-[600px] rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
                      <p className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                    <div className="mt-1 px-1 text-right text-xs text-slate-300">
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-slate-50 px-8 py-4 text-center">
        <p className="text-sm text-slate-500">
          Want to plan your own trip?{" "}
          <a href="/chat" className="font-semibold text-violet-600 hover:text-violet-700">
            Start chatting with Voyr AI →
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SharedConversationPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
            <PiLightningFill className="h-6 w-6 animate-pulse text-violet-500" />
          </div>
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    }>
      <SharedConversationContent />
    </Suspense>
  );
}
