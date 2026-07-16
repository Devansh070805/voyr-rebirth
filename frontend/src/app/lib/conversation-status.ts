/** Maps conversation.status from API to user-facing booking/planning labels. */

export const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  active: "Planning",
  package_created: "Package created",
  quote_ready: "Quote ready",
  checkout_ready: "Awaiting payment",
  paid: "Payment received",
  confirmed: "Confirmed",
  archived: "Archived",
};

export const CONVERSATION_STATUS_STYLES: Record<string, string> = {
  active: "bg-violet-100 text-violet-700",
  package_created: "bg-blue-100 text-blue-700",
  quote_ready: "bg-amber-100 text-amber-800",
  checkout_ready: "bg-orange-100 text-orange-800",
  paid: "bg-emerald-100 text-emerald-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  archived: "bg-slate-100 text-slate-600",
};

export function getConversationStatusLabel(status: string): string {
  return CONVERSATION_STATUS_LABELS[status] || status.replace(/_/g, " ");
}

export function getConversationStatusStyle(status: string): string {
  return CONVERSATION_STATUS_STYLES[status] || CONVERSATION_STATUS_STYLES.active;
}

/** Trips with booking progress (for Bookings page). */
export function isBookingPipelineStatus(status: string): boolean {
  return ["package_created", "quote_ready", "checkout_ready", "paid", "confirmed"].includes(
    status,
  );
}
