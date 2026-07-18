"use client";

import { PiCheckBold, PiCircleNotchBold } from "react-icons/pi";

interface SelectButtonProps {
  label: string;
  selectedLabel?: string;
  selected?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function SelectButton({
  label,
  selectedLabel = "Selected",
  selected = false,
  loading = false,
  onClick,
  className = "",
}: SelectButtonProps) {
  // Always render the button — if onClick is missing show a disabled state
  // (previously returning null caused the button to disappear entirely)
  return (
    <button
      type="button"
      onClick={onClick ?? undefined}
      disabled={loading || selected || !onClick}
      className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
        selected
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : !onClick
            ? "border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
            : "border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 active:scale-95"
      } disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <PiCircleNotchBold className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </span>
      ) : selected ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <PiCheckBold className="h-3.5 w-3.5" />
          {selectedLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
