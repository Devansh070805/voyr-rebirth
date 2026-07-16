"use client";

import { useState } from "react";
import {
  PiLightningFill,
  PiCalendarBlankFill,
  PiCaretRightBold,
  PiSunFill,
  PiUsersFill,
  PiIdentificationCardFill,
} from "react-icons/pi";
import type { BookingState } from "@/types/chat";
import TripMap from "./TripMap";
import { DAY_IMAGES } from "./chat-types";
import type { PlanSelections, TripState } from "./chat-types";
import PlanSelectionsSummary from "./PlanSelectionsSummary";

interface RightPanelProps {
  tripState: TripState;
  bookingState: BookingState;
  planSelections?: PlanSelections;
  embedded?: boolean;
}

export default function RightPanel({
  tripState,
  bookingState,
  planSelections,
  embedded = false,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<"itinerary" | "details" | "map">("itinerary");
  const [expanded, setExpanded] = useState(false);

  const hasTrip = !!tripState.destination;
  const visibleDays = expanded ? tripState.days_plan : tripState.days_plan.slice(0, 4);

  const asideClass = embedded
    ? "w-full shrink-0 bg-white px-3 py-4 overflow-y-auto"
    : "hidden w-[340px] shrink-0 border-l border-slate-100 bg-white px-5 py-6 overflow-y-auto lg:block";

  if (!hasTrip) {
    return (
      <aside className={asideClass}>
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
            <PiLightningFill className="h-8 w-8 text-violet-300" />
          </div>
          <h3 className="mt-4 font-bold text-slate-400">No trip yet</h3>
          <p className="mt-2 text-sm text-slate-300">
            Start chatting to plan your trip. Your itinerary and details will appear here.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={asideClass}>
      {planSelections && (
        <div className="mb-4">
          <PlanSelectionsSummary planSelections={planSelections} />
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-3 border-b border-slate-200 text-center text-sm font-bold">
          <button
            onClick={() => setActiveTab("itinerary")}
            className={`py-4 transition-colors ${
              activeTab === "itinerary"
                ? "border-b-2 border-violet-600 text-violet-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Itinerary
          </button>
          <button
            onClick={() => setActiveTab("details")}
            className={`py-4 transition-colors ${
              activeTab === "details"
                ? "border-b-2 border-violet-600 text-violet-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("map")}
            className={`py-4 transition-colors ${
              activeTab === "map"
                ? "border-b-2 border-violet-600 text-violet-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Map
          </button>
        </div>
        <div className="p-4">
          {activeTab === "itinerary" ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-950">Itinerary Overview</h3>
                {tripState.days_plan.length > 4 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
                  >
                    {expanded ? "Show less" : "View all"}{" "}
                    <PiCaretRightBold
                      className={`h-3 w-3 transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}
                    />
                  </button>
                )}
              </div>
              <div className="mb-4 flex items-center gap-4 text-sm font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <PiCalendarBlankFill className="h-4 w-4" /> {tripState.nights} Nights /{" "}
                  {tripState.days} Days
                </span>
                <span className="flex items-center gap-1.5">
                  <PiUsersFill className="h-4 w-4" /> {tripState.travelers}
                </span>
              </div>
              <div className="space-y-3">
                {visibleDays.map((day, idx) => (
                  <div key={day.day_number} className="grid grid-cols-[72px_1fr] gap-3">
                    <img
                      src={DAY_IMAGES[idx % DAY_IMAGES.length]}
                      alt=""
                      className="h-[64px] w-[72px] rounded-lg object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <PiSunFill className="h-3 w-3 text-amber-400" />
                        <span className="text-xs font-bold text-slate-900">
                          Day {day.day_number} — {day.title}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        {day.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {!expanded && tripState.days_plan.length > 4 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  +{tripState.days_plan.length - 4} more days
                </button>
              )}
            </>
          ) : activeTab === "details" ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Destination
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {tripState.destination}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Duration
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {tripState.nights} Nights / {tripState.days} Days
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Travelers
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {tripState.travelers}{" "}
                  {tripState.travelers === 1 ? "Traveler" : "Travelers"}
                </div>
              </div>
              {tripState.estimated_budget && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Est. Budget
                  </div>
                  <div className="mt-1 text-sm font-semibold text-violet-600">
                    ₹{tripState.estimated_budget.toLocaleString("en-IN")} per person
                  </div>
                </div>
              )}
              {tripState.trip_type.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Trip Style
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {tripState.trip_type.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Status
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-600">Planning</span>
                </div>
              </div>

              {/* Visa Check Link */}
              <a
                href={`/travel-visa?destination=${encodeURIComponent(tripState.destination || "")}`}
                className="mt-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
              >
                <PiIdentificationCardFill className="h-5 w-5 text-violet-500" />
                <span>Check Visa Requirements</span>
                <span className="ml-auto text-violet-400">→</span>
              </a>
            </div>
          ) : activeTab === "map" ? (
            <TripMap
              destination={tripState.destination || ""}
              days_plan={tripState.days_plan}
            />
          ) : null}
        </div>
      </div>

      {/* Cost Summary */}
      {tripState.budget_items.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-bold text-slate-950">Cost Summary</h3>
          <div className="space-y-2.5 text-sm">
            {tripState.budget_items.map((item) => (
              <div key={item.category} className="flex justify-between text-slate-600">
                <span>{item.category}</span>
                <span className="font-semibold">₹{item.amount.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
          {tripState.estimated_budget && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex justify-between">
                <span className="font-bold text-slate-900">Per Person</span>
                <span className="text-lg font-extrabold text-violet-600">
                  ₹{tripState.estimated_budget.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking Status */}
      {bookingState.status !== "idle" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-bold text-slate-950">Booking Status</h3>
          <div className="space-y-3">
            {/* Package step */}
            <div className="flex items-center gap-3">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                bookingState.packageId ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
              }`}>
                {bookingState.packageId ? "✓" : "1"}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-700">Package Created</div>
                {bookingState.packageId && (
                  <div className="text-[10px] text-slate-400 font-mono">{bookingState.packageId.slice(0, 8)}...</div>
                )}
              </div>
            </div>

            {/* Quote step */}
            <div className="flex items-center gap-3">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                bookingState.quoteId ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
              }`}>
                {bookingState.quoteId ? "✓" : "2"}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-700">Quote Generated</div>
                {bookingState.finalAmount != null && (
                  <div className="text-xs font-bold text-violet-600">₹{bookingState.finalAmount.toLocaleString("en-IN")}</div>
                )}
              </div>
            </div>

            {/* Payment step */}
            <div className="flex items-center gap-3">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                bookingState.checkoutUrl ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
              }`}>
                {bookingState.checkoutUrl ? "✓" : "3"}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-700">Payment</div>
                {bookingState.checkoutUrl && (
                  <a
                    href={bookingState.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700 underline"
                  >
                    Go to checkout →
                  </a>
                )}
              </div>
            </div>

            {/* Error */}
            {bookingState.error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {bookingState.error}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
