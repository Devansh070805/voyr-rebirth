"use client";

import type { DocumentRow, FeeRow, RequirementRow, VisaEditRow, VisaTabKey } from "./types";

export default function VisaEditForm({
  tab,
  editing,
  passport,
  onCancel,
  onSubmit,
}: {
  tab: VisaTabKey;
  editing: VisaEditRow;
  passport: string;
  onCancel: () => void;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  if (tab === "corrections") return null;

  return (
    <form
      className="mb-6 rounded-xl border border-violet-200 bg-violet-50/50 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(new FormData(e.currentTarget));
      }}
    >
      <h2 className="mb-3 text-sm font-bold text-violet-900">
        {editing.id ? "Edit record" : "New record"}
      </h2>
      {tab === "requirements" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            name="passport_country"
            defaultValue={(editing as RequirementRow).passport_country || passport}
            placeholder="Passport (IN)"
            className="rounded border px-2 py-1 text-sm"
            required
          />
          <input
            name="destination_country"
            defaultValue={(editing as RequirementRow).destination_country || ""}
            placeholder="Destination"
            className="rounded border px-2 py-1 text-sm"
            required
          />
          <input
            name="visa_status"
            defaultValue={(editing as RequirementRow).visa_status || "visa_required"}
            placeholder="visa_status"
            className="rounded border px-2 py-1 text-sm"
            required
          />
          <input
            name="visa_type"
            defaultValue={(editing as RequirementRow).visa_type || ""}
            placeholder="visa_type"
            className="rounded border px-2 py-1 text-sm"
          />
          <input
            name="max_stay_days"
            type="number"
            defaultValue={(editing as RequirementRow).max_stay_days ?? ""}
            placeholder="max_stay_days"
            className="rounded border px-2 py-1 text-sm"
          />
          <input name="notes" placeholder="notes" className="rounded border px-2 py-1 text-sm" />
        </div>
      )}
      {tab === "documents" && (() => {
        const doc = editing as DocumentRow;
        return (
          <div className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={doc.id || ""} />
            <input
              name="destination_country"
              defaultValue={doc.destination_country || ""}
              placeholder="Country"
              className="rounded border px-2 py-1 text-sm"
              required
            />
            <input
              name="visa_type"
              defaultValue={doc.visa_type || "tourist"}
              placeholder="visa_type"
              className="rounded border px-2 py-1 text-sm"
              required
            />
            <input
              name="document_type"
              defaultValue={doc.document_type || ""}
              placeholder="document_type"
              className="rounded border px-2 py-1 text-sm"
              required
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_required" defaultChecked={doc.is_required ?? true} />
              Required
            </label>
            <input
              name="description"
              defaultValue={doc.description || ""}
              placeholder="description"
              className="rounded border px-2 py-1 text-sm sm:col-span-2"
            />
            <input name="sort_order" type="number" defaultValue={0} className="rounded border px-2 py-1 text-sm" />
          </div>
        );
      })()}
      {tab === "fees" && (() => {
        const fee = editing as FeeRow;
        return (
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              name="destination_country"
              defaultValue={fee.destination_country || ""}
              placeholder="Country"
              className="rounded border px-2 py-1 text-sm"
              required
            />
            <input
              name="visa_type"
              defaultValue={fee.visa_type || "tourist"}
              placeholder="visa_type"
              className="rounded border px-2 py-1 text-sm"
              required
            />
            <input
              name="fee_amount"
              type="number"
              defaultValue={fee.fee_amount ?? ""}
              placeholder="fee_amount"
              className="rounded border px-2 py-1 text-sm"
            />
            <input
              name="fee_currency"
              defaultValue={fee.fee_currency || "USD"}
              className="rounded border px-2 py-1 text-sm"
            />
            <input
              name="min_days"
              type="number"
              defaultValue={fee.processing_time_days_min ?? ""}
              placeholder="min days"
              className="rounded border px-2 py-1 text-sm"
            />
            <input
              name="max_days"
              type="number"
              defaultValue={fee.processing_time_days_max ?? ""}
              placeholder="max days"
              className="rounded border px-2 py-1 text-sm"
            />
            <input
              name="notes"
              defaultValue={fee.notes || ""}
              placeholder="notes"
              className="rounded border px-2 py-1 text-sm sm:col-span-2"
            />
          </div>
        );
      })()}
      <div className="mt-3 flex gap-2">
        <button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
