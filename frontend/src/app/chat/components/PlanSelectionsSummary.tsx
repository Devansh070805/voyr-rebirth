"use client";

import {
  PiBuildingsFill,
  PiCrosshairFill,
  PiAirplaneTiltFill,
  PiTicketFill,
  PiCheckCircleFill,
} from "react-icons/pi";
import type { PlanSelections } from "./chat-types";

function hasSelections(plan: PlanSelections): boolean {
  return !!(
    plan.hotel ||
    plan.activities.length > 0 ||
    plan.flight ||
    plan.ticket
  );
}

export default function PlanSelectionsSummary({ planSelections }: { planSelections: PlanSelections }) {
  if (!hasSelections(planSelections)) return null;

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm animate-scale-in">
      <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-950">
        <PiCheckCircleFill className="h-4 w-4 text-emerald-500" />
        Your selections
      </h3>
      <div className="space-y-2.5 text-sm">
        {planSelections.hotel && (
          <div className="flex items-start gap-2 text-slate-700">
            <PiBuildingsFill className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Hotel</div>
              <div className="font-semibold">{planSelections.hotel.name}</div>
            </div>
          </div>
        )}
        {planSelections.activities.length > 0 && (
          <div className="flex items-start gap-2 text-slate-700">
            <PiCrosshairFill className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Activities ({planSelections.activities.length})
              </div>
              <ul className="mt-0.5 space-y-0.5">
                {planSelections.activities.map((a) => (
                  <li key={a.id} className="font-semibold">
                    {a.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {planSelections.flight && (
          <div className="flex items-start gap-2 text-slate-700">
            <PiAirplaneTiltFill className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Flight</div>
              <div className="font-semibold">{planSelections.flight.label}</div>
            </div>
          </div>
        )}
        {planSelections.ticket && (
          <div className="flex items-start gap-2 text-slate-700">
            <PiTicketFill className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Ticket</div>
              <div className="font-semibold">{planSelections.ticket.name}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
