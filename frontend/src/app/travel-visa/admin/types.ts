export interface RequirementRow {
  id: number;
  passport_country: string;
  destination_country: string;
  visa_status: string;
  visa_type: string | null;
  max_stay_days: number | null;
  last_verified: string | null;
}

export interface DocumentRow {
  id: number;
  destination_country: string;
  visa_type: string;
  document_type: string;
  is_required: boolean;
  description: string | null;
}

export interface FeeRow {
  id: number;
  destination_country: string;
  visa_type: string;
  fee_amount: number | null;
  fee_currency: string;
  processing_time_days_min: number | null;
  processing_time_days_max: number | null;
  notes: string | null;
}

export interface CorrectionRow {
  id: number;
  field: string;
  current_value: string | null;
  suggested_value: string;
  status: string;
  created_at: string;
}

export type VisaTabKey = "requirements" | "documents" | "fees" | "corrections";

export type VisaEditRow =
  | RequirementRow
  | DocumentRow
  | FeeRow
  | Partial<RequirementRow & DocumentRow & FeeRow> & { id: number };
