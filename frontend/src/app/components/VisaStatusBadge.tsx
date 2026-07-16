"use client";


export type VisaStatus =
  | "visa_free"
  | "visa_on_arrival"
  | "eta_required"
  | "evisa_available"
  | "visa_required"
  | "visa_free_restricted"
  | "admission_refused"
  | "covid_ban"
  | "unknown";

const STATUS_STYLES: Record<VisaStatus, string> = {
  visa_free: "bg-emerald-100 text-emerald-700 border-emerald-200",
  visa_on_arrival: "bg-blue-100 text-blue-700 border-blue-200",
  eta_required: "bg-violet-50 text-violet-700 border-violet-200",
  evisa_available: "bg-blue-50 text-blue-700 border-blue-200",
  visa_required: "bg-amber-50 text-amber-700 border-amber-200",
  visa_free_restricted: "bg-lime-50 text-lime-700 border-lime-200",
  admission_refused: "bg-rose-50 text-rose-700 border-rose-200",
  covid_ban: "bg-orange-50 text-orange-700 border-orange-200",
  unknown: "bg-slate-50 text-slate-700 border-slate-200",
};

const STATUS_LABELS: Record<VisaStatus, string> = {
  visa_free: "Visa Free",
  visa_on_arrival: "Visa on Arrival",
  eta_required: "eTA Required",
  evisa_available: "e-Visa Available",
  visa_required: "Visa Required",
  visa_free_restricted: "Visa Free (Restricted)",
  admission_refused: "Entry Not Allowed",
  covid_ban: "COVID Restrictions",
  unknown: "Unknown",
};

interface VisaStatusBadgeProps {
  status: VisaStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function VisaStatusBadge({ status, size = "md", className = "" }: VisaStatusBadgeProps) {
  const colors = STATUS_STYLES[status] || STATUS_STYLES.unknown;
  const label = STATUS_LABELS[status] || "Unknown";

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-sm",
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-bold ${colors} ${sizeClasses[size]} ${className}`}>
      {label}
    </span>
  );
}

