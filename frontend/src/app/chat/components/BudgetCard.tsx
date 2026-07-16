"use client";

import { PiCurrencyInrFill, PiUsersFill } from "react-icons/pi";
import { formatPrice } from "./chat-types";

interface BudgetItem {
  category: string;
  amount: number;
  note?: string;
}

interface BudgetCardProps {
  destination: string;
  currency: string;
  items: BudgetItem[];
  total_per_person: number;
  total_trip?: number;
  travelers: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Flights: "bg-blue-100 text-blue-700",
  Hotels: "bg-violet-100 text-violet-700",
  Activities: "bg-emerald-100 text-emerald-700",
  Transfers: "bg-amber-100 text-amber-700",
  Meals: "bg-rose-100 text-rose-700",
  Insurance: "bg-cyan-100 text-cyan-700",
  Visa: "bg-indigo-100 text-indigo-700",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "bg-slate-100 text-slate-700";
}

export default function BudgetCard({
  destination,
  currency,
  items,
  total_per_person,
  total_trip,
  travelers,
}: BudgetCardProps) {
  const maxAmount = Math.max(...items.map((i) => i.amount), 1);
  const computedTotal = total_trip ?? total_per_person * travelers;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-scale-in">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiCurrencyInrFill className="h-5 w-5 text-violet-500" />
            <h3 className="font-bold text-slate-900">Budget Breakdown — {destination}</h3>
          </div>
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            <PiUsersFill className="h-4 w-4" /> {travelers} {travelers === 1 ? "person" : "people"}
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.category}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                  {item.note && <span className="text-xs text-slate-400">{item.note}</span>}
                </div>
                <span className="font-semibold text-slate-700">
                  {formatPrice(item.amount, currency)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-400 transition-all duration-500"
                  style={{ width: `${(item.amount / maxAmount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Per person</span>
            <span className="font-bold text-slate-900">
              {formatPrice(total_per_person, currency)}
            </span>
          </div>
          {travelers > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total trip ({travelers} people)</span>
              <span className="text-lg font-extrabold text-violet-600">
                {formatPrice(computedTotal, currency)}
              </span>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          * Estimates based on typical pricing. Actual costs may vary.
        </p>
      </div>
    </div>
  );
}
