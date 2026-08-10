import { asc, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import {
  booking,
  type BookingRow,
  enquiry,
  type EnquiryRow,
  payment,
  type PaymentRow,
  quote,
  type QuoteRow,
  transportOperator,
  type TransportOperatorRow,
} from "@/db/schema"
import { type BookingStatus, isInflow } from "@/domain/status"

export type BookingDetail = {
  booking: BookingRow
  quote: QuoteRow
  enquiry: EnquiryRow
  operator: TransportOperatorRow
}

const detailSelection = {
  booking,
  quote,
  enquiry,
  operator: transportOperator,
}

export async function listBookings(statuses?: readonly BookingStatus[]): Promise<BookingDetail[]> {
  const query = db()
    .select(detailSelection)
    .from(booking)
    .innerJoin(quote, eq(booking.quoteId, quote.id))
    .innerJoin(enquiry, eq(booking.enquiryId, enquiry.id))
    .innerJoin(transportOperator, eq(quote.operatorId, transportOperator.id))

  return statuses
    ? query.where(inArray(booking.status, [...statuses])).orderBy(asc(enquiry.startAt))
    : query.orderBy(asc(enquiry.startAt))
}

export async function getBooking(id: string): Promise<BookingDetail | undefined> {
  const rows = await db()
    .select(detailSelection)
    .from(booking)
    .innerJoin(quote, eq(booking.quoteId, quote.id))
    .innerJoin(enquiry, eq(booking.enquiryId, enquiry.id))
    .innerJoin(transportOperator, eq(quote.operatorId, transportOperator.id))
    .where(eq(booking.id, id))
    .limit(1)
  return rows[0]
}

export async function createBooking(
  values: typeof booking.$inferInsert,
): Promise<BookingRow | undefined> {
  const rows = await db().insert(booking).values(values).returning()
  return rows[0]
}

export async function updateBooking(
  id: string,
  values: Partial<typeof booking.$inferInsert>,
): Promise<void> {
  await db().update(booking).set(values).where(eq(booking.id, id))
}

export async function listPayments(bookingId: string): Promise<PaymentRow[]> {
  return db()
    .select()
    .from(payment)
    .where(eq(payment.bookingId, bookingId))
    .orderBy(desc(payment.at))
}

export async function recordPayment(values: typeof payment.$inferInsert): Promise<void> {
  await db().insert(payment).values(values)
}

export type MoneyPosition = {
  collectedPaise: number
  paidOutPaise: number
  dueFromCustomerPaise: number
  dueToOperatorPaise: number
}

/**
 * Where a booking's money stands, derived from the ledger rather than stored.
 *
 * A refund reduces what has been collected rather than counting as a payout:
 * money going back to the customer is not the operator being paid, and adding
 * it to payouts would make the operator look settled when they have had
 * nothing.
 */
export function moneyPosition(
  quoteRow: Pick<QuoteRow, "totalPaise" | "operatorPayoutPaise">,
  payments: readonly PaymentRow[],
): MoneyPosition {
  let collectedPaise = 0
  let paidOutPaise = 0

  for (const row of payments) {
    if (isInflow(row.kind)) collectedPaise += row.amountPaise
    else if (row.kind === "refund") collectedPaise -= row.amountPaise
    else paidOutPaise += row.amountPaise
  }

  return {
    collectedPaise,
    paidOutPaise,
    dueFromCustomerPaise: Math.max(0, quoteRow.totalPaise - collectedPaise),
    dueToOperatorPaise: Math.max(0, quoteRow.operatorPayoutPaise - paidOutPaise),
  }
}
