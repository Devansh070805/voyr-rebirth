"use client";

import { PiCheckCircleFill, PiXCircleFill, PiArrowsLeftRightFill } from "react-icons/pi";

interface ComparisonOption {
  name: string;
  pros: string[];
  cons: string[];
  budget: string;
  best_for: string;
  weather?: string;
}

interface ComparisonCardProps {
  title: string;
  options: ComparisonOption[];
}

export default function ComparisonCard({ title, options }: ComparisonCardProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-scale-in">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900"><PiArrowsLeftRightFill className="mr-1.5 inline-block h-5 w-5 -mt-0.5 text-violet-500" /> {title}</h3>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {options.map((option, idx) => (
          <div
            key={option.name}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 animate-slide-up-sm"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <h4 className="text-lg font-bold text-slate-900">{option.name}</h4>

            <div className="mt-3 space-y-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Pros</span>
                <ul className="mt-1 space-y-1">
                  {option.pros.map((pro) => (
                    <li key={pro} className="flex items-start gap-1.5 text-sm text-slate-600">
                      <PiCheckCircleFill className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Cons</span>
                <ul className="mt-1 space-y-1">
                  {option.cons.map((con) => (
                    <li key={con} className="flex items-start gap-1.5 text-sm text-slate-600">
                      <PiXCircleFill className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
              <div>
                <span className="text-xs text-slate-400">Budget</span>
                <div className="text-sm font-semibold text-slate-700">{option.budget}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Best for</span>
                <div className="text-sm font-semibold text-slate-700">{option.best_for}</div>
              </div>
              {option.weather && (
                <div className="col-span-2">
                  <span className="text-xs text-slate-400">Weather</span>
                  <div className="text-sm font-semibold text-slate-700">{option.weather}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
