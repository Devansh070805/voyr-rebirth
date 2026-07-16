"use client";

import type { MarginRuleRow } from "./types";
import { EMPTY_RULE } from "./types";

interface MarginRuleFormProps {
  editingRule: MarginRuleRow | null | undefined;
  onSave: (form: FormData) => Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
}

export default function MarginRuleForm({
  editingRule,
  onSave,
  onCancel,
  onError,
}: MarginRuleFormProps) {
  return (
    <form
      key={editingRule?.id ?? "new"}
      className="mb-4 rounded-lg border border-violet-100 bg-violet-50/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSave(new FormData(e.currentTarget));
        } catch (err) {
          onError(err instanceof Error ? err.message : "Save failed");
        }
      }}
    >
      <input type="hidden" name="id" value={editingRule?.id || ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">
          Provider
          <input
            name="provider"
            defaultValue={editingRule?.provider ?? EMPTY_RULE.provider}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Listing type
          <input
            name="listing_type"
            defaultValue={editingRule?.listing_type ?? EMPTY_RULE.listing_type}
            placeholder="hotel"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Destination slug
          <input
            name="destination_slug"
            defaultValue={editingRule?.destination_slug ?? EMPTY_RULE.destination_slug}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Segment
          <select
            name="customer_segment"
            defaultValue={editingRule?.customer_segment ?? EMPTY_RULE.customer_segment}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="b2c">B2C</option>
            <option value="b2b">B2B</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Margin type
          <select
            name="margin_type"
            defaultValue={editingRule?.margin_type ?? EMPTY_RULE.margin_type}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="percent">Percent</option>
            <option value="flat">Flat</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Margin value
          <input
            name="margin_value"
            type="number"
            step="0.01"
            required
            defaultValue={editingRule?.margin_value ?? EMPTY_RULE.margin_value}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Min margin
          <input
            name="min_margin_amount"
            type="number"
            step="0.01"
            defaultValue={editingRule?.min_margin_amount ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={editingRule?.is_active ?? EMPTY_RULE.is_active}
          />
          Active
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
