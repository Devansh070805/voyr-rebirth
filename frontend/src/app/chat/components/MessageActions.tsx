"use client";

import { useState } from "react";
import { PiCopyFill, PiArrowCounterClockwiseFill, PiCheckFill } from "react-icons/pi";
import type { ChatMessage } from "@/types/chat";

interface MessageActionsProps {
  message: ChatMessage;
  onRegenerate: () => void;
}

export default function MessageActions({ message, onRegenerate }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        onClick={handleCopy}
        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors"
        title="Copy message"
      >
        {copied ? <PiCheckFill className="h-3.5 w-3.5 text-emerald-500" /> : <PiCopyFill className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={onRegenerate}
        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors"
        title="Regenerate response"
      >
        <PiArrowCounterClockwiseFill className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
