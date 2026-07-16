"use client";

import { PiXBold, PiMapTrifoldFill } from "react-icons/pi";
import type { BookingState } from "@/types/chat";
import type { PlanSelections, TripState } from "./chat-types";
import PlanSelectionsSummary from "./PlanSelectionsSummary";
import RightPanel from "./RightPanel";

interface MobilePlanSheetProps {
  open: boolean;
  onClose: () => void;
  tripState: TripState;
  bookingState: BookingState;
  planSelections: PlanSelections;
}

export default function MobilePlanSheet({
  open,
  onClose,
  tripState,
  bookingState,
  planSelections,
}: MobilePlanSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close plan sheet"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <PiMapTrifoldFill className="h-5 w-5 text-violet-500" />
            Trip plan
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          >
            <PiXBold className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 pb-8">
          <div className="mb-4">
            <PlanSelectionsSummary planSelections={planSelections} />
          </div>
          <div className="-mx-4">
            <RightPanel
              tripState={tripState}
              bookingState={bookingState}
              planSelections={planSelections}
              embedded
            />
          </div>
        </div>
      </div>
    </div>
  );
}
