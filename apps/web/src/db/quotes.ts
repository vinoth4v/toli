import { and, desc, eq, inArray, ne } from "drizzle-orm"
import { db } from "@/db/client"
import {
  quote,
  type QuoteRow,
  transportOperator,
  type TransportOperatorRow,
  vehicle,
  type VehicleRow,
} from "@/db/schema"
import type { QuoteStatus } from "@/domain/status"

export type QuoteWithOperator = {
  quote: QuoteRow
  operator: TransportOperatorRow
  vehicle: VehicleRow | null
}

export async function listQuotesForEnquiry(enquiryId: string): Promise<QuoteWithOperator[]> {
  return db()
    .select({ quote, operator: transportOperator, vehicle })
    .from(quote)
    .innerJoin(transportOperator, eq(quote.operatorId, transportOperator.id))
    .leftJoin(vehicle, eq(quote.vehicleId, vehicle.id))
    .where(eq(quote.enquiryId, enquiryId))
    .orderBy(desc(quote.createdAt))
}

export async function getQuote(id: string): Promise<QuoteWithOperator | undefined> {
  const rows = await db()
    .select({ quote, operator: transportOperator, vehicle })
    .from(quote)
    .innerJoin(transportOperator, eq(quote.operatorId, transportOperator.id))
    .leftJoin(vehicle, eq(quote.vehicleId, vehicle.id))
    .where(eq(quote.id, id))
    .limit(1)
  return rows[0]
}

export async function createQuote(
  values: typeof quote.$inferInsert,
): Promise<QuoteRow | undefined> {
  const rows = await db().insert(quote).values(values).returning()
  return rows[0]
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  await db().update(quote).set({ status }).where(eq(quote.id, id))
}

/**
 * Close out the quotes that lost.
 *
 * Called when one is accepted: a quote left sitting at "sent" after the group
 * has booked someone else will be chased by that operator, which is a phone
 * call nobody needs. Drafts are swept up too — they were never shown to
 * anyone, and leaving them open only clutters the enquiry.
 */
export async function declineOtherQuotes(enquiryId: string, keepId: string): Promise<void> {
  await db()
    .update(quote)
    .set({ status: "declined" })
    .where(
      and(
        eq(quote.enquiryId, enquiryId),
        ne(quote.id, keepId),
        inArray(quote.status, ["draft", "sent"]),
      ),
    )
}
