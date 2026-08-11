import { and, asc, desc, eq, inArray, ne } from "drizzle-orm"
import { db } from "@/db/client"
import {
  type Assignment,
  assignment,
  type Booking,
  booking,
  type Customer,
  customer,
  type Dispute,
  type Driver,
  dispute,
  driver,
  type Invoice,
  invoice,
  type LocationPing,
  locationPing,
  type Operator,
  operator,
  type Payment,
  payment,
  type Quote,
  quote,
  type Review,
  review,
  type Settlement,
  type Stop,
  settlement,
  stop,
  type TripEvent,
  type TripExpense,
  type TripRequest,
  tripEvent,
  tripExpense,
  tripRequest,
  type Vehicle,
  vehicle,
  vehicleDocument,
} from "@/db/schema"
import { assessVehicle, canAssignToTrip } from "@/domain/compliance"
import { financialYear, invoiceNumber, reference, trackingToken } from "@/domain/format"
import { extractGstFromGross } from "@/domain/gst"
import { isIntraState, placeOfSupply } from "@/domain/india"
import { applyBps } from "@/domain/money"
import { computeSettlement } from "@/domain/settlement"
import { commissionBpsFor, getSettings } from "./settings"

/**
 * Everything after "yes, that quote".
 *
 * The booking is a copy, not a reference: the agreed total, the commission
 * rate and the tax treatment are all frozen onto it at acceptance. A rate card
 * edited next Tuesday must not be able to change what an operator is owed for
 * a trip that ran last Friday.
 */

export type BookingDetail = {
  booking: Booking
  request: TripRequest
  customer: Customer
  operator: Operator
  quote: Quote
  stops: Stop[]
  payments: Payment[]
  assignment: (Assignment & { vehicle: Vehicle; driver: Driver }) | null
  events: TripEvent[]
  expenses: TripExpense[]
  pings: LocationPing[]
  invoice: Invoice | null
  settlement: Settlement | null
  review: Review | null
  disputes: Dispute[]
}

/**
 * Accepts a quote and turns it into a booking.
 *
 * Also rejects the losing quotes, because leaving them open is how an operator
 * ends up holding a vehicle for a trip somebody else is running.
 */
export async function acceptQuote(
  quoteId: string,
  source: "quote" | "instant" = "quote",
): Promise<Booking> {
  const rows = await db()
    .select({ quote, request: tripRequest, operator, customer })
    .from(quote)
    .innerJoin(tripRequest, eq(quote.tripRequestId, tripRequest.id))
    .innerJoin(operator, eq(quote.operatorId, operator.id))
    .innerJoin(customer, eq(tripRequest.customerId, customer.id))
    .where(eq(quote.id, quoteId))
    .limit(1)

  const found = rows[0]
  if (!found) throw new Error("Quote not found")
  if (found.quote.status !== "submitted") {
    throw new Error("Only a submitted quote can be accepted")
  }

  const settings = await getSettings()
  const count = await db().select({ id: booking.id }).from(booking)

  const created = await db()
    .insert(booking)
    .values({
      reference: reference("B", count.length + 1),
      source,
      tripRequestId: found.request.id,
      quoteId: found.quote.id,
      customerId: found.customer.id,
      operatorId: found.operator.id,
      agreedTotalPaise: found.quote.estimatedTotalPaise,
      advanceDuePaise: applyBps(found.quote.estimatedTotalPaise, settings.advanceBps),
      commissionBps: commissionBpsFor(settings, found.operator.commissionBps),
      gstTreatment: found.quote.gstTreatment,
      placeOfSupply: placeOfSupply({
        originState: found.request.state,
        customerGstin: found.customer.gstin,
      }),
      intraState: isIntraState({
        supplierState: settings.homeState,
        originState: found.request.state,
        customerGstin: found.customer.gstin,
      }),
      trackingToken: trackingToken(),
    })
    .returning()

  const row = created[0]
  if (!row) throw new Error("booking could not be created")

  await db().update(quote).set({ status: "accepted" }).where(eq(quote.id, quoteId))
  await db()
    .update(quote)
    .set({ status: "rejected" })
    .where(and(eq(quote.tripRequestId, found.request.id), ne(quote.id, quoteId)))
  await db()
    .update(tripRequest)
    .set({ status: "booked" })
    .where(eq(tripRequest.id, found.request.id))

  return row
}

export async function listBookings(limit = 100) {
  return db()
    .select({ booking, request: tripRequest, customer, operator })
    .from(booking)
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .innerJoin(customer, eq(booking.customerId, customer.id))
    .innerJoin(operator, eq(booking.operatorId, operator.id))
    .orderBy(desc(booking.createdAt))
    .limit(limit)
}

export async function getBooking(id: string): Promise<BookingDetail | null> {
  const rows = await db()
    .select({ booking, request: tripRequest, customer, operator, quote })
    .from(booking)
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .innerJoin(customer, eq(booking.customerId, customer.id))
    .innerJoin(operator, eq(booking.operatorId, operator.id))
    .innerJoin(quote, eq(booking.quoteId, quote.id))
    .where(eq(booking.id, id))
    .limit(1)

  const found = rows[0]
  if (!found) return null

  const [
    stops,
    payments,
    assignments,
    events,
    expenses,
    pings,
    invoices,
    settlements,
    reviews,
    disputes,
  ] = await Promise.all([
    db()
      .select()
      .from(stop)
      .where(eq(stop.tripRequestId, found.request.id))
      .orderBy(asc(stop.sequence)),
    db().select().from(payment).where(eq(payment.bookingId, id)).orderBy(asc(payment.createdAt)),
    db()
      .select({ assignment, vehicle, driver })
      .from(assignment)
      .innerJoin(vehicle, eq(assignment.vehicleId, vehicle.id))
      .innerJoin(driver, eq(assignment.driverId, driver.id))
      .where(eq(assignment.bookingId, id))
      .orderBy(desc(assignment.assignedAt))
      .limit(1),
    db().select().from(tripEvent).where(eq(tripEvent.bookingId, id)).orderBy(asc(tripEvent.at)),
    db().select().from(tripExpense).where(eq(tripExpense.bookingId, id)),
    db()
      .select()
      .from(locationPing)
      .where(eq(locationPing.bookingId, id))
      .orderBy(desc(locationPing.at))
      .limit(50),
    db().select().from(invoice).where(eq(invoice.bookingId, id)).limit(1),
    db().select().from(settlement).where(eq(settlement.bookingId, id)).limit(1),
    db().select().from(review).where(eq(review.bookingId, id)).limit(1),
    db().select().from(dispute).where(eq(dispute.bookingId, id)).orderBy(desc(dispute.createdAt)),
  ])

  const assigned = assignments[0]

  return {
    booking: found.booking,
    request: found.request,
    customer: found.customer,
    operator: found.operator,
    quote: found.quote,
    stops,
    payments,
    assignment: assigned
      ? { ...assigned.assignment, vehicle: assigned.vehicle, driver: assigned.driver }
      : null,
    events,
    expenses,
    pings,
    invoice: invoices[0] ?? null,
    settlement: settlements[0] ?? null,
    review: reviews[0] ?? null,
    disputes,
  }
}

export async function recordPayment(input: {
  bookingId: string
  kind: Payment["kind"]
  mode: Payment["mode"]
  amountPaise: number
  gatewayRef: string | null
}): Promise<void> {
  await db()
    .insert(payment)
    .values({
      ...input,
      // Recorded by ops after the fact, so it is captured by definition. A
      // gateway webhook would write `pending` first and settle it later.
      status: "captured",
      collectedAt: new Date(),
    })
}

/**
 * Assigns a vehicle and driver — and refuses when the paperwork says no.
 *
 * This is the one place §8.5's rule has teeth. An expired fitness certificate
 * or a missing AITP on an interstate trip stops the assignment here, where it
 * costs a phone call, rather than at a check post, where it costs the trip.
 */
export async function assignVehicle(input: {
  bookingId: string
  vehicleId: string
  driverId: string
  subContractedToOperatorId: string | null
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rows = await db()
    .select({ booking, request: tripRequest, vehicle })
    .from(booking)
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .innerJoin(vehicle, eq(vehicle.id, input.vehicleId))
    .where(eq(booking.id, input.bookingId))
    .limit(1)

  const found = rows[0]
  if (!found) return { ok: false, reason: "Booking or vehicle not found" }

  const documents = await db()
    .select()
    .from(vehicleDocument)
    .where(eq(vehicleDocument.vehicleId, input.vehicleId))

  // Judged against the day of the trip, not today: a permit that expires next
  // week is fine for tomorrow's departure and not for the one after it.
  const assessment = assessVehicle({
    documents: documents.map((document) => ({
      kind: document.kind,
      expiresOn: document.expiresOn,
      verification: document.verification,
    })),
    yearOfManufacture: found.vehicle.yearOfManufacture,
    asOf: found.request.startAt,
  })

  const verdict = canAssignToTrip(assessment, { interstate: found.request.interstate })
  if (!verdict.allowed) {
    return { ok: false, reason: verdict.reason ?? "Vehicle is not fit for service" }
  }

  if (found.vehicle.status !== "active") {
    return { ok: false, reason: `Vehicle is ${found.vehicle.status}, not active` }
  }

  await db().insert(assignment).values(input)
  await db().update(booking).set({ status: "assigned" }).where(eq(booking.id, input.bookingId))

  return { ok: true }
}

/** Trip lifecycle events, and the booking status each one implies. */
const STATUS_FOR_EVENT: Partial<Record<TripEvent["kind"], Booking["status"]>> = {
  started: "in_transit",
  completed: "completed",
}

export async function addTripEvent(input: {
  bookingId: string
  kind: TripEvent["kind"]
  detail: string | null
  odometerKm: number | null
  lat: string | null
  lng: string | null
}): Promise<void> {
  await db().insert(tripEvent).values(input)

  const status = STATUS_FOR_EVENT[input.kind]
  if (status) {
    await db().update(booking).set({ status }).where(eq(booking.id, input.bookingId))
  }

  // An event with a position is also a position: the tracking page should not
  // go blank between GPS pings just because the driver pressed a button.
  if (input.lat && input.lng) {
    await db()
      .insert(locationPing)
      .values({ bookingId: input.bookingId, lat: input.lat, lng: input.lng, source: "trip_event" })
  }
}

export async function addExpense(input: {
  bookingId: string
  kind: TripExpense["kind"]
  amountPaise: number
  receiptUrl: string | null
}): Promise<void> {
  await db().insert(tripExpense).values(input)
}

export async function addPing(input: {
  bookingId: string
  lat: string
  lng: string
  speedKmph: number | null
  source: string
}): Promise<void> {
  await db().insert(locationPing).values(input)
}

/**
 * Issues the GST invoice.
 *
 * The agreed total is inclusive of tax — that is the number the customer
 * compared and accepted — so the taxable value is extracted from it rather
 * than the tax being added on top a second time.
 */
export async function issueInvoice(bookingId: string): Promise<Invoice> {
  const rows = await db()
    .select({ booking, customer })
    .from(booking)
    .innerJoin(customer, eq(booking.customerId, customer.id))
    .where(eq(booking.id, bookingId))
    .limit(1)

  const found = rows[0]
  if (!found) throw new Error("Booking not found")

  const existing = await db()
    .select()
    .from(invoice)
    .where(eq(invoice.bookingId, bookingId))
    .limit(1)
  if (existing[0]) return existing[0]

  const issuedAt = new Date()
  const year = financialYear(issuedAt)
  const issuedThisYear = await db().select({ id: invoice.id }).from(invoice)

  const gst = extractGstFromGross(
    found.booking.agreedTotalPaise,
    found.booking.gstTreatment,
    found.booking.intraState,
  )

  const created = await db()
    .insert(invoice)
    .values({
      bookingId,
      number: invoiceNumber(year, issuedThisYear.length + 1),
      issuedAt,
      taxablePaise: gst.taxablePaise,
      cgstPaise: gst.cgstPaise,
      sgstPaise: gst.sgstPaise,
      igstPaise: gst.igstPaise,
      totalPaise: gst.totalPaise,
      gstTreatment: found.booking.gstTreatment,
      gstRateBps: gst.rateBps,
      sacCode: gst.sacCode,
      placeOfSupply: found.booking.placeOfSupply,
      customerGstin: found.customer.gstin,
    })
    .returning()

  const row = created[0]
  if (!row) throw new Error("invoice could not be created")
  return row
}

/**
 * Builds the operator's settlement from what actually happened on the trip.
 *
 * Recomputed on each call until it is released, because expenses and cash
 * collection arrive late — a driver's toll receipt is photographed at 11 PM.
 * Once released it is frozen, since by then it is a statement the operator has
 * been shown.
 */
export async function buildSettlement(bookingId: string): Promise<Settlement> {
  const rows = await db().select().from(booking).where(eq(booking.id, bookingId)).limit(1)
  const found = rows[0]
  if (!found) throw new Error("Booking not found")

  const existing = await db()
    .select()
    .from(settlement)
    .where(eq(settlement.bookingId, bookingId))
    .limit(1)

  if (existing[0] && existing[0].status !== "pending") return existing[0]

  const settings = await getSettings()
  const expenses = await db().select().from(tripExpense).where(eq(tripExpense.bookingId, bookingId))
  const payments = await db().select().from(payment).where(eq(payment.bookingId, bookingId))

  const breakdown = computeSettlement({
    grossPaise: found.agreedTotalPaise,
    commissionBps: found.commissionBps,
    tcsBps: settings.tcsBps,
    tdsBps: settings.tdsBps,
    expensesReimbursedPaise: expenses.reduce((total, row) => total + row.amountPaise, 0),
    cashCollectedPaise: payments
      .filter((row) => row.mode === "cash_to_driver" && row.status === "captured")
      .reduce((total, row) => total + row.amountPaise, 0),
  })

  const values = {
    bookingId,
    grossPaise: breakdown.grossPaise,
    commissionPaise: breakdown.commissionPaise,
    tcsPaise: breakdown.tcsPaise,
    tdsPaise: breakdown.tdsPaise,
    expensesReimbursedPaise: breakdown.expensesReimbursedPaise,
    cashCollectedPaise: breakdown.cashCollectedPaise,
    netPayablePaise: breakdown.netPayablePaise,
  }

  if (existing[0]) {
    await db().update(settlement).set(values).where(eq(settlement.id, existing[0].id))
    return { ...existing[0], ...values }
  }

  const created = await db().insert(settlement).values(values).returning()
  const row = created[0]
  if (!row) throw new Error("settlement could not be created")
  return row
}

export async function releaseSettlement(bookingId: string): Promise<void> {
  await db()
    .update(settlement)
    .set({ status: "released", releasedAt: new Date() })
    .where(eq(settlement.bookingId, bookingId))
}

export async function markSettlementPaid(bookingId: string, utr: string): Promise<void> {
  await db()
    .update(settlement)
    .set({ status: "paid", paidAt: new Date(), utr })
    .where(eq(settlement.bookingId, bookingId))
}

export async function addReview(input: {
  bookingId: string
  cleanliness: number
  driverBehaviour: number
  punctuality: number
  matchedBooking: number
  comment: string | null
}): Promise<void> {
  await db().insert(review).values(input).onConflictDoNothing()
}

export async function openDispute(input: {
  bookingId: string
  kind: string
  description: string
}): Promise<void> {
  await db().insert(dispute).values(input)
}

export async function resolveDispute(input: {
  id: string
  status: Dispute["status"]
  resolution: string
  refundPaise: number
}): Promise<void> {
  await db()
    .update(dispute)
    .set({
      status: input.status,
      resolution: input.resolution,
      refundPaise: input.refundPaise,
      resolvedAt: new Date(),
    })
    .where(eq(dispute.id, input.id))
}

export async function cancelBooking(id: string, reason: string): Promise<void> {
  await db()
    .update(booking)
    .set({ status: "cancelled", cancellationReason: reason, cancelledAt: new Date() })
    .where(eq(booking.id, id))
}

/**
 * What the public tracking page is allowed to know.
 *
 * Deliberately a narrow projection rather than the booking row: sixty wedding
 * guests will hold this link, and none of them needs the operator's commission
 * rate, the customer's phone number or the trip's price. §8.6 calls this
 * purpose limitation; it is also just obvious.
 */
export type PublicTrip = {
  reference: string
  status: Booking["status"]
  city: string
  startAt: Date
  passengerCount: number
  vehicleLabel: string | null
  vehicleRegistration: string | null
  driverFirstName: string | null
  operatorName: string
  stops: { label: string; sequence: number }[]
  events: { kind: TripEvent["kind"]; at: Date; detail: string | null }[]
  latest: { lat: string; lng: string; at: Date } | null
}

export async function getPublicTrip(token: string): Promise<PublicTrip | null> {
  const rows = await db()
    .select({ booking, request: tripRequest, operator })
    .from(booking)
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .innerJoin(operator, eq(booking.operatorId, operator.id))
    .where(eq(booking.trackingToken, token))
    .limit(1)

  const found = rows[0]
  if (!found) return null

  const [assignments, stops, events, pings] = await Promise.all([
    db()
      .select({ vehicle, driver })
      .from(assignment)
      .innerJoin(vehicle, eq(assignment.vehicleId, vehicle.id))
      .innerJoin(driver, eq(assignment.driverId, driver.id))
      .where(eq(assignment.bookingId, found.booking.id))
      .orderBy(desc(assignment.assignedAt))
      .limit(1),
    db()
      .select()
      .from(stop)
      .where(eq(stop.tripRequestId, found.request.id))
      .orderBy(asc(stop.sequence)),
    db()
      .select()
      .from(tripEvent)
      .where(
        and(
          eq(tripEvent.bookingId, found.booking.id),
          // A guest sees progress, not incidents. An SOS is for the ops desk
          // and the emergency contacts, not for a link on a WhatsApp group.
          inArray(tripEvent.kind, ["dispatched", "started", "stop_reached", "completed"]),
        ),
      )
      .orderBy(asc(tripEvent.at)),
    db()
      .select()
      .from(locationPing)
      .where(eq(locationPing.bookingId, found.booking.id))
      .orderBy(desc(locationPing.at))
      .limit(1),
  ])

  const assigned = assignments[0]
  const latest = pings[0]

  return {
    reference: found.booking.reference,
    status: found.booking.status,
    city: found.request.city,
    startAt: found.request.startAt,
    passengerCount: found.request.passengerCount,
    vehicleLabel: assigned ? `${assigned.vehicle.seats}-seater` : null,
    vehicleRegistration: assigned?.vehicle.registrationNumber ?? null,
    driverFirstName: assigned?.driver.name.split(" ")[0] ?? null,
    operatorName: found.operator.name,
    stops: stops.map((row) => ({ label: row.label, sequence: row.sequence })),
    events: events.map((row) => ({ kind: row.kind, at: row.at, detail: row.detail })),
    latest: latest ? { lat: latest.lat, lng: latest.lng, at: latest.at } : null,
  }
}
