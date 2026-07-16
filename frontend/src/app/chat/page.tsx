"use client";

import { Suspense } from "react";
import { ChatPageContent } from "./ChatPageContent";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm font-semibold text-slate-400">Loading chat...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
