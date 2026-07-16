"use client";

import { PiCheckCircleFill, PiPencilSimpleFill } from "react-icons/pi";
import type { DocumentRow } from "./types";

export default function DocumentsTab({
  rows,
  onEdit,
}: {
  rows: DocumentRow[];
  onEdit: (row: DocumentRow) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-4 py-3 text-left font-bold">Country</th>
          <th className="px-4 py-3 text-left font-bold">Document</th>
          <th className="px-4 py-3 text-left font-bold">Required</th>
          <th className="px-4 py-3 text-left font-bold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 font-semibold">{row.destination_country}</td>
            <td className="px-4 py-3">{row.document_type}</td>
            <td className="px-4 py-3">
              {row.is_required ? <PiCheckCircleFill className="h-4 w-4 text-emerald-500" /> : "—"}
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
