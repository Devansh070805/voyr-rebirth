"use client";

import { PiSparkleFill } from "react-icons/pi";

export default function ListingBadge({ label = "Voyr Pick" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
      <PiSparkleFill className="h-3 w-3" />
      {label}
    </span>
  );
}
