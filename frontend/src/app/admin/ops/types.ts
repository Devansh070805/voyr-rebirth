export type OpsTab =
  | "active-bookings"
  | "failed-payments"
  | "expired-quotes"
  | "supplier-pending"
  | "document-failures"
  | "refund-requests"
  | "fulfillments";

export interface OpsBookingRow {
  id: string;
  quote_id: string;
  status: string;
  created_at: string;
}

export interface OpsPaymentRow {
  id: string;
  quote_id: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface OpsQuoteRow {
  id: string;
  package_id: string;
  final_amount: number;
  status: string;
  valid_until: string;
}

export interface OpsDocumentJobRow {
  id: string;
  booking_id: string;
  status: string;
}

export interface OpsFulfillmentRow {
  id: string;
  booking_id: string;
  supply_source: string;
  supply_product: string;
  fulfillment_status: string;
  settlement_status: string;
  sell_amount: number;
  cost_amount: number;
  currency: string;
  created_at: string;
}

export type OpsRow =
  | OpsBookingRow
  | OpsPaymentRow
  | OpsQuoteRow
  | OpsDocumentJobRow
  | OpsFulfillmentRow;

export function isOpsFulfillmentRow(row: OpsRow): row is OpsFulfillmentRow {
  return "supply_source" in row && "fulfillment_status" in row;
}

export function isOpsPaymentRow(row: OpsRow): row is OpsPaymentRow {
  return "amount" in row;
}

export function isOpsQuoteRow(row: OpsRow): row is OpsQuoteRow {
  return "package_id" in row;
}

export function isOpsDocumentJobRow(row: OpsRow): row is OpsDocumentJobRow {
  return "booking_id" in row && !("quote_id" in row);
}
