export type PartnerStatus = 'active' | 'revoked';
export type MemberStatus = 'active' | 'revoked';

export interface B2BPartner {
  id: string;
  name: string;
  company_code: string;
  contact_email: string | null;
  notes: string | null;
  status: PartnerStatus;
  created_at: string;
  updated_at: string;
}

export interface B2BPartnerMember {
  id: string;
  partner_id: string;
  user_id: string | null;
  email: string;
  status: MemberStatus;
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface B2BPartnerWithMembers extends B2BPartner {
  members: B2BPartnerMember[];
  active_member_count: number;
}

export interface PartnerAccessInfo {
  has_access: boolean;
  customer_segment: 'b2c' | 'b2b';
  partner: Pick<B2BPartner, 'id' | 'name' | 'company_code'> | null;
}

export interface CreatePartnerDto {
  name: string;
  company_code: string;
  contact_email?: string;
  notes?: string;
}

export interface UpdatePartnerDto {
  name?: string;
  contact_email?: string;
  notes?: string;
  status?: PartnerStatus;
}

export interface GrantAccessDto {
  email: string;
}
