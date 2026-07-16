"use client";

import ListingBadge from "./ListingBadge";
import { isVoyrPick, type CuratedOptionMeta } from "./option-utils";

interface OptionCardShellProps {
  children: React.ReactNode;
  option?: CuratedOptionMeta;
  selected?: boolean;
  loading?: boolean;
  className?: string;
  animationDelay?: number;
  layout?: "card" | "row";
}

export default function OptionCardShell({
  children,
  option,
  selected = false,
  loading = false,
  className = "",
  animationDelay = 0,
  layout = "card",
}: OptionCardShellProps) {
  const featured = option ? isVoyrPick(option) : false;
  const base =
    layout === "card"
      ? "rounded-lg border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-slide-up-sm"
      : "flex items-start gap-4 px-5 py-3.5 transition-all duration-200 hover:bg-slate-50 animate-slide-up-sm";

  return (
    <div
      className={`${base} ${
        selected
          ? "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200"
          : featured
            ? "border-violet-200 bg-violet-50/40"
            : "border-slate-200 bg-white"
      } ${loading ? "opacity-70" : ""} ${className}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {featured && option && layout === "card" && (
        <div className="mb-2">
          <ListingBadge label={option.badges?.[0] || "Voyr Pick"} />
        </div>
      )}
      {children}
    </div>
  );
}
