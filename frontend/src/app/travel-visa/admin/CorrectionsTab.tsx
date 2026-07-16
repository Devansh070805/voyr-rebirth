"use client";

import type { CorrectionRow } from "./types";

export default function CorrectionsTab({
  rows,
  onPatch,
}: {
  rows: CorrectionRow[];
  onPatch: (id: number, status: string) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-4 py-3 text-left font-bold">Field</th>
          <th className="px-4 py-3 text-left font-bold">Suggested</th>
          <th className="px-4 py-3 text-left font-bold">Status</th>
          <th className="px-4 py-3 text-left font-bold">Review</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-semibold">{row.field}</td>
            <td className="px-4 py-3 text-xs text-violet-600">{row.suggested_value}</td>
            <td className="px-4 py-3">{row.status}</td>
            <td className="px-4 py-3">
              {row.status === "pending" && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onPatch(row.id, "approved")}
                    className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onPatch(row.id, "rejected")}
                    className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
