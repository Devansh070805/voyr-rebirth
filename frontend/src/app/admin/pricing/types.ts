/**
 * Admin pricing types — re-exported from @voyr/shared for API contract parity.
 */
export type {
  MarginRule,
  ApplyMarginResult,
  CreateMarginRuleDto,
  CustomerSegment,
  MarginType,
} from '@voyr/shared';

/** @deprecated Use MarginRule — kept for existing admin UI imports */
export type { MarginRule as MarginRuleRow } from '@voyr/shared';

/** @deprecated Use ApplyMarginResult — kept for existing admin UI imports */
export type { ApplyMarginResult as MarginPreviewResult } from '@voyr/shared';

export const EMPTY_RULE = {
  provider: "all",
  listing_type: "",
  destination_slug: "",
  customer_segment: "b2c" as const,
  margin_type: "percent" as const,
  margin_value: 10,
  min_margin_amount: "",
  is_active: true,
};
