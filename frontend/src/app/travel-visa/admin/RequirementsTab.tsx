"use client";

import { PiPencilSimpleFill, PiTrashFill } from "react-icons/pi";
import type { RequirementRow } from "./types";

export default function RequirementsTab({
  rows,
  onEdit,
  onDelete,
}: {
  rows: RequirementRow[];
  onEdit: (row: RequirementRow) => void;
  onDelete: (passport: string, destination: string) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-4 py-3 text-left font-bold">Passport</th>
          <th className="px-4 py-3 text-left font-bold">Destination</th>
          <th className="px-4 py-3 text-left font-bold">Status</th>
          <th className="px-4 py-3 text-left font-bold">Type</th>
          <th className="px-4 py-3 text-left font-bold">Max Stay</th>
          <th className="px-4 py-3 text-left font-bold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs">{row.passport_country}</td>
            <td className="px-4 py-3 font-semibold">{row.destination_country}</td>
            <td className="px-4 py-3">{row.visa_status}</td>
            <td className="px-4 py-3 text-xs">{row.visa_type || "—"}</td>
            <td className="px-4 py-3">{row.max_stay_days ? `${row.max_stay_days}d` : "—"}</td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <button type="button" onClick={() => onEdit(row)} className="text-violet-600">
                  <PiPencilSimpleFill />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(row.passport_country, row.destination_country)}
                  className="text-red-500"
                >
                  <PiTrashFill />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
