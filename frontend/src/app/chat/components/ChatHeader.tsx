"use client";

import { useState } from "react";
import {
  PiPencilSimpleFill,
  PiShareFatFill,
  PiDownloadSimpleFill,
  PiShieldCheckFill,
  PiMapPinFill,
  PiBookmarkSimpleFill,
} from "react-icons/pi";
import type { TripState } from "./chat-types";
import type { ChatMessage } from "@/types/chat";
import { getDestinationImage } from "../../lib/utils";
import { useApi } from "../../auth/context";

interface ChatHeaderProps {
  tripState: TripState;
  messages: ChatMessage[];
  conversationId: string | null;
  onShare: () => void;
  onBook: () => void;
  onTitleUpdated?: (title: string) => void;
  onSaved?: () => void;
}

function buildTripMarkdown(messages: ChatMessage[], tripState: TripState): string {
  const title = tripState.destination ? `${tripState.destination} Trip` : "Voyr Trip";
  const lines = [`# ${title}`, ""];
  if (tripState.nights) lines.push(`- **Nights:** ${tripState.nights}`);
  if (tripState.travelers) lines.push(`- **Travelers:** ${tripState.travelers}`);
  if (tripState.estimated_budget) {
    lines.push(`- **Budget:** ₹${tripState.estimated_budget.toLocaleString("en-IN")}`);
  }
  lines.push("", "---", "");
  for (const msg of messages) {
    if (msg.id === "welcome") continue;
    lines.push(`## ${msg.role === "user" ? "You" : "Voyr"}`, "", msg.content, "");
  }
  return lines.join("\n");
}

export default function ChatHeader({
  tripState,
  messages,
  conversationId,
  onShare,
  onBook,
  onTitleUpdated,
  onSaved,
}: ChatHeaderProps) {
  const { apiFetch } = useApi();
  const [shareToast, setShareToast] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const handleShare = () => {
    onShare();
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  const handleExport = () => {
    const md = buildTripMarkdown(messages, tripState);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(tripState.destination || "trip").replace(/\s+/g, "-").toLowerCase()}-itinerary.md`;
    a.click();
    URL.revokeObjectURL(url);
    setActionToast("Itinerary downloaded");
    setTimeout(() => setActionToast(null), 2000);
  };

  const handleRename = async () => {
    if (!conversationId) {
      setActionToast("Start chatting to save this trip first");
      setTimeout(() => setActionToast(null), 2000);
      return;
    }
    const current =
      tripState.destination ? `${tripState.destination} Trip` : "New Trip";
    const next = window.prompt("Trip name", current);
    if (!next?.trim()) return;
    try {
      const res = await apiFetch(`/conversations/${conversationId}/title`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.trim() }),
      });
      if (res.ok) {
        onTitleUpdated?.(next.trim());
        setActionToast("Trip renamed");
      } else {
        setActionToast("Could not rename trip");
      }
    } catch {
      setActionToast("Could not rename trip");
    }
    setTimeout(() => setActionToast(null), 2000);
  };

  const handleSave = async () => {
    if (!tripState.destination) {
      setActionToast("Plan a destination first");
      setTimeout(() => setActionToast(null), 2000);
      return;
    }
    try {
      const res = await apiFetch("/saved-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${tripState.destination} Trip`,
          type: "Destination",
          location: tripState.destination,
          price: tripState.estimated_budget
            ? `₹${tripState.estimated_budget.toLocaleString("en-IN")}`
            : "—",
          image: getDestinationImage(tripState.destination),
          conversationId,
        }),
      });
      if (res.ok) {
        onSaved?.();
        setActionToast("Saved to wishlist");
      } else {
        setActionToast("Sign in to save trips");
      }
    } catch {
      setActionToast("Could not save trip");
    }
    setTimeout(() => setActionToast(null), 2000);
  };

  const title = tripState.destination ? `${tripState.destination} Trip` : "New Trip";

  const subtitle = [
    tripState.travelers
      ? `${tripState.travelers} ${tripState.travelers === 1 ? "Traveler" : "Travelers"}`
      : null,
    tripState.nights ? `${tripState.nights} Nights` : null,
    tripState.estimated_budget
      ? `Budget ₹${tripState.estimated_budget.toLocaleString("en-IN")}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const toastMessage = actionToast || (shareToast ? "Share link copied!" : null);

  return (
    <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
          <PiMapPinFill className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-950">{title}</h1>
            <button
              type="button"
              onClick={() => void handleRename()}
              className="text-slate-300 hover:text-slate-500 transition-colors"
              title="Rename trip"
            >
              <PiPencilSimpleFill className="h-3.5 w-3.5" />
            </button>
          </div>
          {subtitle && <p className="text-xs font-medium text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {tripState.destination && (
          <button
            type="button"
            onClick={() => void handleSave()}
            className="btn-press flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50"
          >
            <PiBookmarkSimpleFill className="h-3.5 w-3.5" /> Save
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={handleShare}
            className="btn-press flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50"
          >
            <PiShareFatFill className="h-3.5 w-3.5" /> Share
          </button>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={handleExport}
            className="btn-press flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50"
          >
            <PiDownloadSimpleFill className="h-3.5 w-3.5" /> Export
          </button>
        </div>
        {tripState.destination && (
          <button
            type="button"
            onClick={onBook}
            className="btn-press flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-200 transition-all duration-200 hover:bg-violet-700"
          >
            <PiShieldCheckFill className="h-3.5 w-3.5" /> Book Trip
          </button>
        )}
        {toastMessage && (
          <div className="absolute right-8 top-full z-10 mt-2 animate-toast-in whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
            {toastMessage}
          </div>
        )}
      </div>
    </header>
  );
}
