/**
 * The state each entity can be in, and what may follow what.
 *
 * Kept in one file because the transitions are the business process: an enquiry
 * that can jump from "new" straight to "won" without a quote is a booking with
 * no agreed price, which is exactly the dispute this marketplace exists to
 * prevent. The database stores text; these tables are what enforce the order.
 */

export const ENQUIRY_STATUSES = ["new", "quoted", "won", "lost", "cancelled"] as const
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  cancelled: "Cancelled",
}

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
}

export const BOOKING_STATUSES = ["confirmed", "on_trip", "completed", "cancelled"] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  on_trip: "On trip",
  completed: "Completed",
  cancelled: "Cancelled",
}

/** A booking moves forward, or it is cancelled. It never moves back. */
const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  confirmed: ["on_trip", "cancelled"],
  on_trip: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to)
}

export function nextBookingStatuses(from: BookingStatus): readonly BookingStatus[] {
  return BOOKING_TRANSITIONS[from]
}

export const OPERATOR_STATUSES = ["pending", "verified", "suspended"] as const
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number]

export const OPERATOR_STATUS_LABELS: Record<OperatorStatus, string> = {
  pending: "Pending verification",
  verified: "Verified",
  suspended: "Suspended",
}

/**
 * Only a verified operator may be quoted to a customer. Verification is the one
 * thing an aggregator sells that a WhatsApp group does not (§1), so the rule
 * lives in code rather than in an ops habit.
 */
export function canQuote(status: OperatorStatus): boolean {
  return status === "verified"
}

export const PAYMENT_KINDS = [
  "customer_advance",
  "customer_balance",
  "operator_payout",
  "refund",
] as const
export type PaymentKind = (typeof PAYMENT_KINDS)[number]

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  customer_advance: "Advance from customer",
  customer_balance: "Balance from customer",
  operator_payout: "Payout to operator",
  refund: "Refund to customer",
}

/** Money in from the customer, versus money out to an operator or back. */
export function isInflow(kind: PaymentKind): boolean {
  return kind === "customer_advance" || kind === "customer_balance"
}

export const PAYMENT_METHODS = ["upi", "bank_transfer", "card", "cash"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
}
