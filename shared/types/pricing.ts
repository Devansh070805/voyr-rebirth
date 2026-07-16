/**
 * Shared pricing types — margin rules and apply-margin API contract.
 */

export type CustomerSegment = 'b2c' | 'b2b' | 'all';

export type MarginType = 'percent' | 'flat';

export interface MarginRule {
  id: string;
  provider: string;
  listing_type: string | null;
  destination_slug: string | null;
  customer_segment: CustomerSegment;
  margin_type: MarginType;
  margin_value: number;
  min_margin_amount: number | null;
  is_active: boolean;
}

export interface ApplyMarginResult {
  displayPrice: number;
  marginAmount: number;
  ruleId: string | null;
  costPrice: number;
}

export interface CreateMarginRuleDto {
  provider: string;
  listing_type?: string;
  destination_slug?: string;
  customer_segment?: CustomerSegment;
  margin_type?: MarginType;
  margin_value: number;
  min_margin_amount?: number;
  is_active?: boolean;
}

export type UpdateMarginRuleDto = Partial<CreateMarginRuleDto>;
