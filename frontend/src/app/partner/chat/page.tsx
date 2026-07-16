"use client";

import { Suspense } from "react";
import PartnerGate from "../../components/partner/PartnerGate";
import { ChatPageContent } from "../../chat/ChatPageContent";

export default function PartnerChatPage() {
  return (
    <PartnerGate>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-400">
            Loading partner planner…
          </div>
        }
      >
        <ChatPageContent variant="partner" />
      </Suspense>
    </PartnerGate>
  );
}
