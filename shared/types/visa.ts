/**
 * Shared Travel Visa Types
 * Single source of truth for visa-related types across frontend and backend.
 */

export type VisaStatus =
  | 'visa_free'
  | 'visa_on_arrival'
  | 'eta_required'
  | 'evisa_available'
  | 'visa_required'
  | 'visa_free_restricted'
  | 'admission_refused'
  | 'covid_ban'
  | 'unknown';

export interface Country {
  iso_code: string;
  name: string;
  flag_emoji: string | null;
  region: string | null;
  subregion: string | null;
  is_popular_destination: boolean;
  requires_eta: boolean;
  eta_url: string | null;
  official_visa_url: string | null;
  currency: string | null;
  languages: string[] | null;
}

export interface VisaRequirement {
  id: number;
  passport_country: string;
  destination_country: string;
  visa_status: VisaStatus;
  visa_type: string | null;
  max_stay_days: number | null;
  notes: string | null;
  official_source_url: string | null;
  last_verified: string | null;
}

export interface VisaDocument {
  id: number;
  destination_country: string;
  visa_type: string;
  document_type: string;
  is_required: boolean;
  description: string | null;
  notes: string | null;
  sort_order: number;
}

export interface VisaFee {
  id: number;
  destination_country: string;
  visa_type: string;
  fee_amount: number | null;
  fee_currency: string;
  processing_time_days_min: number | null;
  processing_time_days_max: number | null;
  notes: string | null;
}

export interface VisaCheckRequest {
  passport_country: string;
  destination_country: string;
  purpose?: 'tourism' | 'business' | 'transit';
}

export interface MultiVisaCheckRequest {
  passport_country: string;
  destinations: string[];
  purpose?: 'tourism' | 'business' | 'transit';
}

export interface VisaCheckResponse {
  passport_country: Country;
  destination_country: Country;
  visa_status: VisaStatus;
  visa_status_label: string;
  visa_type: string | null;
  max_stay_days: number | null;
  max_stay_label: string | null;
  notes: string | null;
  official_source_url: string | null;
  last_verified: string | null;
  documents: VisaDocument[];
  fees: VisaFee[];
  recommendations: string[];
}

export interface MultiVisaCheckResponse {
  passport_country: Country;
  results: Array<{
    destination_country: Country;
    visa_status: VisaStatus;
    visa_status_label: string;
    max_stay_days: number | null;
    requires_action: boolean;
  }>;
  summary: {
    visa_free_count: number;
    visa_required_count: number;
    eta_required_count: number;
    visa_on_arrival_count: number;
    action_needed: string[];
  };
}

export const VISA_STATUS_LABELS: Record<VisaStatus, string> = {
  visa_free: 'Visa Free',
  visa_on_arrival: 'Visa on Arrival',
  eta_required: 'eTA Required',
  evisa_available: 'e-Visa Available',
  visa_required: 'Visa Required',
  visa_free_restricted: 'Visa Free (Restricted)',
  admission_refused: 'Entry Not Allowed',
  covid_ban: 'COVID Restrictions',
  unknown: 'Information Unavailable',
};

export const VISA_STATUS_COLORS: Record<VisaStatus, { bg: string; text: string; border: string }> = {
  visa_free: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  visa_on_arrival: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  eta_required: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  evisa_available: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  visa_required: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  visa_free_restricted: { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200' },
  admission_refused: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  covid_ban: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  unknown: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};
