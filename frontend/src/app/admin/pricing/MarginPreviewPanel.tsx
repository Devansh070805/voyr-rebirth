"use client";

import { useState } from "react";
import { PiCalculatorFill } from "react-icons/pi";
import type { MarginPreviewResult } from "./types";

interface MarginPreviewPanelProps {
  onPreview: (form: FormData) => Promise<MarginPreviewResult>;
  onError: (message: string) => void;
}

export default function MarginPreviewPanel({ onPreview, onError }: MarginPreviewPanelProps) {
  const [preview, setPreview] = useState<MarginPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
        <PiCalculatorFill className="text-violet-500" /> Price preview
      </h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPreviewLoading(true);
          setPreview(null);
          try {
            const result = await onPreview(new FormData(e.currentTarget));
            setPreview(result);
          } catch (err) {
            onError(err instanceof Error ? err.message : "Preview failed");
          } finally {
            setPreviewLoading(false);
          }
        }}
        className="grid gap-3"
      >
        <label className="text-xs font-bold text-slate-600">
          Base price
          <input
            name="base_price"
            type="number"
            step="0.01"
            required
            defaultValue={1000}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Provider
          <input
            name="preview_provider"
            defaultValue="makcorps"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Listing type
          <input
            name="preview_listing_type"
            defaultValue="hotel"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Destination slug
          <input
            name="preview_destination"
            placeholder="bali"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Customer segment
          <select
            name="preview_segment"
            defaultValue="b2c"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="b2c">B2C</option>
            <option value="b2b">B2B</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={previewLoading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {previewLoading ? "Calculating…" : "Preview price"}
        </button>
      </form>

      {preview && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 animate-scale-in">
          <div className="text-xs font-bold uppercase text-emerald-600">Result</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            ₹{preview.displayPrice.toLocaleString("en-IN")}
          </div>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <div>Cost: ₹{preview.costPrice.toLocaleString("en-IN")}</div>
            <div>Margin: ₹{preview.marginAmount.toLocaleString("en-IN")}</div>
            {preview.ruleId && (
              <div className="font-mono text-xs text-slate-400">Rule: {preview.ruleId}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
