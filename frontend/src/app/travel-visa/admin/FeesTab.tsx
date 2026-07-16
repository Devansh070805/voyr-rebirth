"use client";

import { PiPencilSimpleFill } from "react-icons/pi";
import type { FeeRow } from "./types";

export default function FeesTab({
  rows,
  onEdit,
}: {
  rows: FeeRow[];
  onEdit: (row: FeeRow) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-4 py-3 text-left font-bold">Country</th>
          <th className="px-4 py-3 text-left font-bold">Fee</th>
          <th className="px-4 py-3 text-left font-bold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-semibold">{row.destination_country}</td>
            <td className="px-4 py-3 font-bold">
              {row.fee_amount ? `${row.fee_currency} ${row.fee_amount}` : "—"}
            </td>
            <td className="px-4 py-3">
              <button type="button" onClick={() => onEdit(row)} className="text-violet-600">
                <PiPencilSimpleFill />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
