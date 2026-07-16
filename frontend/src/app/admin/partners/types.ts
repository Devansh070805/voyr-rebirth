export interface PartnerMemberRow {
  id: string;
  partner_id: string;
  user_id: string | null;
  email: string;
  status: "active" | "revoked";
  granted_at: string;
  revoked_at: string | null;
}

export interface PartnerRow {
  id: string;
  name: string;
  company_code: string;
  contact_email: string | null;
  notes: string | null;
  status: "active" | "revoked";
  created_at: string;
  updated_at: string;
  members: PartnerMemberRow[];
  active_member_count: number;
}
