"use client";

import type { ListingEditRow, ListingTabKey } from "./types";

export default function ListingEditForm({
  editing,
  tab,
  onCancel,
  onSubmit,
}: {
  editing: ListingEditRow;
  tab: ListingTabKey;
  onCancel: () => void;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const isNew = !editing.id;

  return (
    <form
      className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(new FormData(e.currentTarget));
      }}
    >
      <h3 className="mb-4 text-sm font-bold text-slate-800">
        {isNew ? "Create listing" : "Edit listing"}
      </h3>
      <input type="hidden" name="id" value={editing.id} />
      <input type="hidden" name="listing_type" value={tab} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-bold text-slate-600">
          Title
          <input
            name="title"
            required
            defaultValue={editing.title}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Destination slug
          <input
            name="destination_slug"
            required
            defaultValue={editing.destination_slug}
            placeholder="bali"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
          Description
          <textarea
            name="description"
            rows={2}
            defaultValue={editing.description}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Cost price
          <input
            name="cost_price"
            type="number"
            step="0.01"
            required
            defaultValue={editing.cost_price}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Sell price
          <input
            name="sell_price"
            type="number"
            step="0.01"
            required
            defaultValue={editing.sell_price}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Currency
          <input
            name="currency"
            defaultValue={editing.currency}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          Priority
          <input
            name="priority"
            type="number"
            defaultValue={editing.priority}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 sm:col-span-2">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={editing.is_active}
            className="rounded"
          />
          Active
        </label>
        <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
          Payload JSON
          <textarea
            name="payload_json"
            rows={6}
            required
            defaultValue={editing.payload_json}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
