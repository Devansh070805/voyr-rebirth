"use client";

import { PiIdentificationCardFill, PiPaperclipFill, PiClipboardFill } from "react-icons/pi";
import VisaStatusBadge, { type VisaStatus } from "../../components/VisaStatusBadge";

interface VisaInfoCardProps {
  destination: string;
  passport_country: string;
  visa_status: string;
  visa_type?: string;
  max_stay_days?: number;
  notes?: string;
  official_source_url?: string;
  recommendations?: string[];
  documents?: Array<{ document_type: string; is_required: boolean; description?: string }>;
}

export default function VisaInfoCard({
  destination,
  passport_country,
  visa_status,
  visa_type,
  max_stay_days,
  notes,
  official_source_url,
  recommendations,
  documents,
}: VisaInfoCardProps) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <PiIdentificationCardFill className="h-7 w-7 text-violet-500 shrink-0" />
        <div>
          <h3 className="font-semibold text-slate-800">Visa Info: {destination}</h3>
          <p className="text-xs text-slate-500">For {passport_country} passport holders</p>
        </div>
      </div>

      <VisaStatusBadge status={visa_status as VisaStatus} size="lg" />

      {visa_type && (
        <p className="mt-2 text-sm text-slate-600"><strong>Type:</strong> {visa_type}</p>
      )}
      {max_stay_days != null && (
        <p className="text-sm text-slate-600"><strong>Max Stay:</strong> {max_stay_days} days</p>
      )}
      {notes && (
        <p className="mt-2 text-sm text-slate-500">{notes}</p>
      )}

      {recommendations && recommendations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Recommendations</p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            {recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {documents && documents.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Required Documents</p>
          <ul className="space-y-1">
            {documents.map((d, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                {d.is_required ? <PiClipboardFill className="h-4 w-4 text-amber-500 shrink-0" /> : <PiPaperclipFill className="h-4 w-4 text-slate-400 shrink-0" />}
                <span>{d.document_type}</span>
                {d.description && <span className="text-slate-400 text-xs">— {d.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {official_source_url && (
        <a
          href={official_source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700"
        >
          Official Visa Portal →
        </a>
      )}

      <a
        href={`/travel-visa?destination=${encodeURIComponent(destination)}`}
        className="mt-3 ml-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-violet-600"
      >
        Full Details →
      </a>
    </div>
  );
}
