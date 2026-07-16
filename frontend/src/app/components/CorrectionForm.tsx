"use client";

import React, { useState } from "react";
import { PiCheckCircleFill, PiXBold, PiWarningCircleFill } from "react-icons/pi";

import { useApi } from "../auth/context";

interface CorrectionFormProps {
  passportCountry: string;
  destinationCountry: string;
  field?: string;
  currentValue?: string;
}

const FIELDS = [
  { value: "visa_status", label: "Visa Status" },
  { value: "visa_type", label: "Visa Type" },
  { value: "max_stay_days", label: "Max Stay (days)" },
  { value: "notes", label: "Notes / Rules" },
  { value: "official_source_url", label: "Official Source URL" },
  { value: "document_requirements", label: "Document Requirements" },
  { value: "fee_amount", label: "Fee Amount" },
  { value: "processing_time", label: "Processing Time" },
  { value: "other", label: "Other" },
];

export default function CorrectionForm({ passportCountry, destinationCountry, field, currentValue }: CorrectionFormProps) {
  const { apiFetch } = useApi();
  const [open, setOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(field || "");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedField || !suggestedValue.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/travel-visa/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport_country: passportCountry,
          destination_country: destinationCountry,
          field: selectedField,
          current_value: currentValue || null,
          suggested_value: suggestedValue.trim(),
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-emerald-700">
          <PiCheckCircleFill className="h-5 w-5" />
          <span className="text-sm font-semibold">Correction submitted — thank you!</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-violet-600 transition-colors"
        >
          <PiWarningCircleFill className="h-4 w-4" />
          Report incorrect information?
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800">Report Correction</h4>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500">
              <PiXBold className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">What needs updating?</label>
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500"
              >
                <option value="">Select field...</option>
                {FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Suggested correction</label>
              <input
                type="text"
                value={suggestedValue}
                onChange={(e) => setSuggestedValue(e.target.value)}
                placeholder="What should it be?"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Additional notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional context or source..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500 resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !selectedField || !suggestedValue.trim()}
              className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {loading ? "Submitting..." : "Submit Correction"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
