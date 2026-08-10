import { and, asc, desc, eq, inArray, isNotNull, ne } from "drizzle-orm"
import { db } from "@/db/client"
import {
  type Customer,
  customer,
  type Operator,
  operator,
  type Quote,
  quote,
  type Stop,
  stop,
  type TripRequest,
  tripRequest,
} from "@/db/schema"
import { type PriceBand, priceBand, routeBand } from "@/domain/fairprice"
import { reference } from "@/domain/format"
import { type PricedQuote, priceQuote, type QuoteTerms, type TripShape } from "@/domain/quote"
import { tripDuration } from "@/domain/trip"

/**
 * The demand side: who is asking, for what, and what the market answered.
 *
 * An RFQ here is not a form submission — it is a fan-out. Inviting operators
 * creates a `requested` quote row per operator before any of them has replied,
 * which is what makes §13's response rate measurable at all: without the
 * invitation on record, an unanswered RFQ is indistinguishable from one nobody
 * was asked about.
 */

export type RequestDetail = {
  request: TripRequest
  customer: Customer
  stops: Stop[]
  quotes: QuoteWithOperator[]
  band: PriceBand | null
  shape: TripShape
}

export type QuoteWithOperator = Quote & {
  operatorName: string
  operatorTier: Operator["tier"]
  /** Recomputed from the stored terms, for the line-by-line breakdown. */
  priced: PricedQuote | null
}

/** The trip shape a quote is priced against — derived once, used everywhere. */
export function shapeOf(request: TripRequest): TripShape {
  const { days, nights } = tripDuration(request.startAt, request.endAt)
  const estimatedKm = request.estimatedKm ?? 0
  return {
    tripType: request.tripType,
    days,
    nights,
    estimatedKm,
    // A tempo traveller averages ~35 km/h door to door on Indian roads once
    // stops and traffic are counted. Only used where the operator did not say.
    estimatedHours: Math.max(days * 8, Math.round(estimatedKm / 35)),
    interstate: request.interstate,
    stateCount: request.statesCrossed.length,
  }
}

export function termsOf(row: Quote): QuoteTerms {
  return {
    baseFarePaise: row.baseFarePaise,
    includedKm: row.includedKm,
    includedHours: row.includedHours,
    extraKmRatePaise: row.extraKmRatePaise,
    extraHourRatePaise: row.extraHourRatePaise,
    perKmRatePaise: row.perKmRatePaise,
    minKmPerDay: row.minKmPerDay,
    driverBataPerDayPaise: row.driverBataPerDayPaise,
    nightHaltPaise: row.nightHaltPaise,
    tollIncluded: row.tollIncluded,
    parkingIncluded: row.parkingIncluded,
    statePermitIncluded: row.statePermitIncluded,
    fuelIncluded: row.fuelIncluded,
    gstTreatment: row.gstTreatment,
  }
}

export async function listRequests(limit = 100) {
  return db()
    .select({ request: tripRequest, customer })
    .from(tripRequest)
    .innerJoin(customer, eq(tripRequest.customerId, customer.id))
    .orderBy(desc(tripRequest.createdAt))
    .limit(limit)
}

export async function getRequest(id: string): Promise<RequestDetail | null> {
  const rows = await db()
    .select({ request: tripRequest, customer })
    .from(tripRequest)
    .innerJoin(customer, eq(tripRequest.customerId, customer.id))
    .where(eq(tripRequest.id, id))
    .limit(1)

  const found = rows[0]
  if (!found) return null

  const stops = await db()
    .select()
    .from(stop)
    .where(eq(stop.tripRequestId, id))
    .orderBy(asc(stop.sequence))

  const quoteRows = await db()
    .select({ quote, operatorName: operator.name, operatorTier: operator.tier })
    .from(quote)
    .innerJoin(operator, eq(quote.operatorId, operator.id))
    .where(eq(quote.tripRequestId, id))
    .orderBy(asc(quote.estimatedTotalPaise))

  const shape = shapeOf(found.request)

  return {
    request: found.request,
    customer: found.customer,
    stops,
    shape,
    quotes: quoteRows.map((row) => ({
      ...row.quote,
      operatorName: row.operatorName,
      operatorTier: row.operatorTier,
      priced: row.quote.status === "requested" ? null : priceQuote(termsOf(row.quote), shape),
    })),
    band: await fairPriceBand(found.request, id),
  }
}

/**
 * §7.2's band, over comparable quotes: same vehicle class, same distance
 * bucket, excluding this request's own quotes so the band is a statement about
 * the market rather than about the five cards on screen.
 */
export async function fairPriceBand(
  request: TripRequest,
  excludeRequestId: string,
): Promise<PriceBand | null> {
  const rows = await db()
    .select({ total: quote.estimatedTotalPaise, km: tripRequest.estimatedKm })
    .from(quote)
    .innerJoin(tripRequest, eq(quote.tripRequestId, tripRequest.id))
    .where(
      and(
        eq(tripRequest.vehicleClass, request.vehicleClass),
        ne(quote.tripRequestId, excludeRequestId),
        inArray(quote.status, ["submitted", "accepted", "rejected", "expired"]),
        isNotNull(quote.submittedAt),
      ),
    )

  const target = routeBand(request.estimatedKm ?? 0)
  const comparable = rows.filter((row) => routeBand(row.km ?? 0) === target).map((row) => row.total)

  return priceBand(comparable)
}

/** Phone is the identity in this market — §4.1's onboarding is phone plus OTP. */
export async function findOrCreateCustomer(input: {
  name: string
  phone: string
  email: string | null
  gstin: string | null
  city: string | null
  segment: string | null
}): Promise<Customer> {
  const existing = await db()
    .select()
    .from(customer)
    .where(eq(customer.phone, input.phone))
    .limit(1)

  if (existing[0]) return existing[0]

  const created = await db().insert(customer).values(input).returning()
  const row = created[0]
  if (!row) throw new Error("customer could not be created")
  return row
}

/**
 * The next reference in a series.
 *
 * A count plus one, which is racy in general and exactly correct here: one
 * operator, one desk, one request at a time. A Postgres sequence is the right
 * answer the day a second person is typing, and it is noted as such.
 */
async function nextReference(prefix: "R" | "B", existing: number): Promise<string> {
  return reference(prefix, existing + 1)
}

export async function createRequest(input: {
  customerId: string
  tripType: TripRequest["tripType"]
  city: string
  state: string
  startAt: Date
  endAt: Date | null
  passengerCount: number
  vehicleClass: TripRequest["vehicleClass"]
  vehicleCount: number
  acRequired: boolean
  features: string[]
  extras: string[]
  interstate: boolean
  statesCrossed: string[]
  estimatedKm: number | null
  notes: string | null
  stops: { label: string; haltMinutes: number | null }[]
}): Promise<TripRequest> {
  const count = await db().select({ id: tripRequest.id }).from(tripRequest)
  const created = await db()
    .insert(tripRequest)
    .values({
      reference: await nextReference("R", count.length),
      customerId: input.customerId,
      tripType: input.tripType,
      city: input.city,
      state: input.state,
      startAt: input.startAt,
      endAt: input.endAt,
      passengerCount: input.passengerCount,
      vehicleClass: input.vehicleClass,
      vehicleCount: input.vehicleCount,
      acRequired: input.acRequired,
      features: input.features,
      extras: input.extras,
      interstate: input.interstate,
      statesCrossed: input.statesCrossed,
      estimatedKm: input.estimatedKm,
      notes: input.notes,
    })
    .returning()

  const row = created[0]
  if (!row) throw new Error("trip request could not be created")

  if (input.stops.length > 0) {
    await db()
      .insert(stop)
      .values(
        input.stops.map((entry, index) => ({
          tripRequestId: row.id,
          sequence: index,
          label: entry.label,
          haltMinutes: entry.haltMinutes,
        })),
      )
  }

  return row
}

/**
 * The fan-out. One `requested` quote per operator, stamped with the moment
 * they were asked — the denominator of every response metric in §13.
 */
export async function inviteOperators(
  requestId: string,
  operatorIds: string[],
  gstTreatment: Quote["gstTreatment"],
): Promise<number> {
  if (operatorIds.length === 0) return 0

  const already = await db()
    .select({ operatorId: quote.operatorId })
    .from(quote)
    .where(eq(quote.tripRequestId, requestId))

  const invited = new Set(already.map((row) => row.operatorId))
  const fresh = operatorIds.filter((id) => !invited.has(id))
  if (fresh.length === 0) return 0

  await db()
    .insert(quote)
    .values(
      fresh.map((operatorId) => ({
        tripRequestId: requestId,
        operatorId,
        status: "requested" as const,
        gstTreatment,
      })),
    )

  await db()
    .update(tripRequest)
    .set({ status: "quoting" })
    .where(and(eq(tripRequest.id, requestId), eq(tripRequest.status, "open")))

  return fresh.length
}

/**
 * Records an operator's answer, with both totals snapshotted.
 *
 * §9: every price shown to a user is snapshotted at display time and a
 * historical price is never recomputed. So the two totals are stored, and the
 * recomputation elsewhere in this app is for showing the working — never for
 * deciding what anybody owes.
 */
export async function submitQuote(
  quoteId: string,
  terms: QuoteTerms,
  shape: TripShape,
  extra: { validUntil: Date | null; notes: string | null; vehicleId: string | null },
): Promise<void> {
  const priced = priceQuote(terms, shape)

  await db()
    .update(quote)
    .set({
      ...terms,
      days: shape.days,
      nights: shape.nights,
      estimatedTotalPaise: priced.estimatedTotalPaise,
      worstCaseTotalPaise: priced.worstCaseTotalPaise,
      status: "submitted",
      submittedAt: new Date(),
      validUntil: extra.validUntil,
      notes: extra.notes,
      vehicleId: extra.vehicleId,
    })
    .where(eq(quote.id, quoteId))
}

export async function getQuote(id: string) {
  const rows = await db()
    .select({ quote, operator, request: tripRequest })
    .from(quote)
    .innerJoin(operator, eq(quote.operatorId, operator.id))
    .innerJoin(tripRequest, eq(quote.tripRequestId, tripRequest.id))
    .where(eq(quote.id, id))
    .limit(1)

  return rows[0] ?? null
}

export async function listCustomers() {
  return db().select().from(customer).orderBy(desc(customer.createdAt)).limit(200)
}

export async function cancelRequest(id: string): Promise<void> {
  await db().update(tripRequest).set({ status: "cancelled" }).where(eq(tripRequest.id, id))
}
