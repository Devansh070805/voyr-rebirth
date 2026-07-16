"use client";

import { useState } from "react";
import {
  PiCalendarBlankFill,
  PiUsersFill,
  PiCheckCircleFill,
  PiCaretDownBold,
  PiMapPinFill,
  PiSunFill,
} from "react-icons/pi";
import { DAY_IMAGES } from "./chat-types";

interface Activity {
  name: string;
  description: string;
  duration_hours?: number;
  category?: string;
}

interface DayPlan {
  day_number: number;
  title: string;
  description: string;
  activities?: Activity[];
}

interface ItineraryCardProps {
  destination: string;
  nights: number;
  days: number;
  travelers: number;
  estimated_budget: number;
  trip_type: string[];
  highlights: string[];
  days_plan: DayPlan[];
}

export default function ItineraryCard({
  destination,
  nights,
  days,
  travelers,
  estimated_budget,
  trip_type,
  highlights,
  days_plan,
}: ItineraryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleDays = expanded ? days_plan : days_plan.slice(0, 3);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm animate-scale-in">
      {/* Header */}
      <div className="border-b border-slate-100 bg-white px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PiMapPinFill className="h-5 w-5 text-violet-500" />
              <h3 className="text-lg font-bold text-slate-900">{destination}</h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <PiCalendarBlankFill className="h-4 w-4" /> {nights} Nights / {days} Days
              </span>
              <span className="flex items-center gap-1.5">
                <PiUsersFill className="h-4 w-4" /> {travelers} {travelers === 1 ? "Traveler" : "Travelers"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-violet-600">
              ₹{estimated_budget.toLocaleString("en-IN")}
            </div>
            <div className="text-xs text-slate-400">per person (est.)</div>
          </div>
        </div>

        {/* Trip type tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {trip_type.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {highlights.map((h) => (
              <span key={h} className="flex items-center gap-1.5 text-sm text-slate-600">
                <PiCheckCircleFill className="h-4 w-4 shrink-0 text-emerald-500" /> {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Day-by-day */}
      <div className="px-5 py-4">
        <div className="space-y-3">
          {visibleDays.map((day, idx) => (
            <div
              key={day.day_number}
              className="flex gap-3 rounded-lg border border-slate-100 bg-white p-3 transition-all duration-200 hover:border-violet-100 hover:shadow-sm animate-slide-up-sm"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <img
                src={DAY_IMAGES[idx % DAY_IMAGES.length]}
                alt=""
                className="h-16 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <PiSunFill className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-sm font-bold text-slate-900">
                    Day {day.day_number} — {day.title}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{day.description}</p>
                {day.activities && day.activities.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {day.activities.slice(0, 3).map((a) => (
                      <span
                        key={a.name}
                        className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                      >
                        {a.name}
                      </span>
                    ))}
                    {day.activities.length > 3 && (
                      <span className="text-xs text-slate-400">+{day.activities.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {days_plan.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50"
          >
            {expanded ? "Show less" : `Show all ${days_plan.length} days`}
            <PiCaretDownBold
              className={`h-3 w-3 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
    </div>
  );
}
