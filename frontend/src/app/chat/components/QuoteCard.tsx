"use client";

import { PiReceiptFill, PiClockFill, PiCheckCircleFill } from "react-icons/pi";
import { formatPrice } from "./chat-types";

interface QuoteCardProps {
  package_id: string;
  quote_id?: string;
  final_amount?: number;
  valid_until?: string;
  success?: boolean;
  error?: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function QuoteCard({
  package_id,
  quote_id,
  final_amount,
  valid_until,
  success = true,
  error,
}: QuoteCardProps) {
  if (!success || error) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-red-200 bg-red-50 shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <PiReceiptFill className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-red-900">Quote Generation Failed</h3>
            <p className="mt-0.5 text-sm text-red-700">{error || "Unable to generate quote"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-blue-200 bg-blue-50 shadow-sm animate-bounce-in">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <PiReceiptFill className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-blue-900">Quote Generated</h3>
              <PiCheckCircleFill className="h-5 w-5 text-blue-500" />
            </div>
            <p className="mt-0.5 text-xs text-blue-500">Package: {package_id}</p>
          </div>
        </div>

        {final_amount != null && (
          <div className="mt-4 flex items-end justify-between rounded-lg bg-white p-4">
            <div>
              <div className="text-xs font-semibold uppercase text-blue-400">Total Amount</div>
              <div className="mt-1 text-3xl font-extrabold text-blue-700">
                {formatPrice(final_amount)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Including taxes & fees</div>
            </div>
            {valid_until && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <PiClockFill className="h-3 w-3" /> Valid until
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-700">
                  {formatDate(valid_until)}
                </div>
              </div>
            )}
          </div>
        )}

        {quote_id && (
          <p className="mt-2 text-xs text-blue-400">Quote ID: {quote_id}</p>
        )}
      </div>
    </div>
  );
}
