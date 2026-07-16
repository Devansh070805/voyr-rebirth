"use client";

import { formatPrice } from "../chat-types";

interface PriceTagProps {
  amount: number;
  currency?: string;
  suffix?: string;
  size?: "sm" | "md";
}

export default function PriceTag({ amount, currency = "INR", suffix, size = "md" }: PriceTagProps) {
  const sizeClass = size === "sm" ? "text-sm font-bold" : "text-lg font-extrabold";
  return (
    <span className={`${sizeClass} text-slate-900`}>
      {formatPrice(amount, currency)}
      {suffix && <span className="text-xs font-normal text-slate-400"> {suffix}</span>}
    </span>
  );
}
