import { and, desc, eq, gte, inArray, or } from "drizzle-orm"
import { db } from "@/db/client"
import {
  assignment,
  booking,
  customer,
  driver,
  invoice,
  locationPing,
  operator,
  payment,
  quote,
  settlement,
  stop,
  tripEvent,
  tripExpense,
  tripRequest,
  vehicle,
  vehicleDocument,
} from "@/db/schema"
import { assessVehicle } from "@/domain/compliance"

/**
 * Queries scoped to whoever is asking.
 *
 * Every function here takes the id from the *session*, never from a URL. That
 * is the whole point: an operator asking for "booking 5fc2…" must be answered
 * only if that booking is theirs, and the way to guarantee it is to make the
 * ownership test part of the query rather than a check somebody remembers to
 * write afterwards. There is no function in this file that can return another
 * party's row.
 *
 * The driver functions go further and do not select money at all — not the
 * trip value, not the quote, not the settlement. §3 is blunt about why: a
 * driver who learns the take rate is a driver who can take the customer
 * off-platform next time.
 */

/* ------------------------------------------------------------- customer */

export async function customerTrips(customerId: string) {
  const requests = await db()
    .select({ request: tripRequest })
    .from(tripRequest)
    .where(eq(tripRequest.customerId, customerId))
    .orderBy(desc(tripRequest.createdAt))

  const bookings = await db()
    .select({ booking, operatorName: operator.name })
    .from(booking)
    .innerJoin(operator, eq(booking.operatorId, operator.id))
    .where(eq(booking.customerId, customerId))

  return requests.map((row) => ({
    request: row.request,
    booking: bookings.find((entry) => entry.booking.tripRequestId === row.request.id) ?? null,
  }))
}

export async function customerTrip(customerId: string, requestId: string) {
  const rows = await db()
    .select({ request: tripRequest })
    .from(tripRequest)
    // Ownership is in the WHERE clause, not in an `if` after the fact.
    .where(and(eq(tripRequest.id, requestId), eq(tripRequest.customerId, customerId)))
    .limit(1)

  const request = rows[0]?.request
  if (!request) return null

  const [stops, quotes, bookings] = await Promise.all([
    db().select().from(stop).where(eq(stop.tripRequestId, request.id)).orderBy(stop.sequence),
    db()
      .select({ quote, operatorName: operator.name, tier: operator.tier })
      .from(quote)
      .innerJoin(operator, eq(quote.operatorId, operator.id))
      // A customer sees answers, not the fact that eleven operators were asked
      // and eight ignored it.
      .where(
        and(
          eq(quote.tripRequestId, request.id),
          inArray(quote.status, ["submitted", "accepted", "rejected"]),
        ),
      )
      .orderBy(quote.estimatedTotalPaise),
    db()
      .select({ booking, operatorName: operator.name })
      .from(booking)
      .innerJoin(operator, eq(booking.operatorId, operator.id))
      .where(eq(booking.tripRequestId, request.id))
      .limit(1),
  ])

  const found = bookings[0] ?? null

  const extras = found
    ? await Promise.all([
        db().select().from(invoice).where(eq(invoice.bookingId, found.booking.id)).limit(1),
        db()
          .select({ assignment, vehicle, driverName: driver.name })
          .from(assignment)
          .innerJoin(vehicle, eq(assignment.vehicleId, vehicle.id))
          .innerJoin(driver, eq(assignment.driverId, driver.id))
          .where(eq(assignment.bookingId, found.booking.id))
          .limit(1),
        // The newest position, for the map on the customer's own trip.
        db()
          .select()
          .from(locationPing)
          .where(eq(locationPing.bookingId, found.booking.id))
          .orderBy(desc(locationPing.at))
          .limit(1),
      ])
    : [[], [], []]

  return {
    request,
    stops,
    quotes,
    booking: found?.booking ?? null,
    operatorName: found?.operatorName ?? null,
    invoice: extras[0]?.[0] ?? null,
    assignment: extras[1]?.[0] ?? null,
    latestPing: extras[2]?.[0] ?? null,
  }
}

/**
 * What a customer's bill is built from — scoped, like everything else here.
 *
 * The quote's inclusion flags decide which expenses are billable at all, so
 * they travel with the expenses rather than being looked up separately and
 * risking the two disagreeing.
 */
export async function tripExpensesFor(customerId: string, bookingId: string) {
  const rows = await db()
    .select({ booking, quote })
    .from(booking)
    .innerJoin(quote, eq(booking.quoteId, quote.id))
    .where(and(eq(booking.id, bookingId), eq(booking.customerId, customerId)))
    .limit(1)

  const found = rows[0]
  if (!found) return null

  const [expenses, payments] = await Promise.all([
    db().select().from(tripExpense).where(eq(tripExpense.bookingId, bookingId)),
    db().select().from(payment).where(eq(payment.bookingId, bookingId)),
  ])

  return {
    tollIncluded: found.quote.tollIncluded,
    parkingIncluded: found.quote.parkingIncluded,
    statePermitIncluded: found.quote.statePermitIncluded,
    expenses: expenses.map((row) => ({ kind: row.kind, amountPaise: row.amountPaise })),
    paidPaise: payments
      .filter((row) => row.status === "captured" && row.kind !== "refund")
      .reduce((total, row) => total + row.amountPaise, 0),
  }
}

/* ------------------------------------------------------------- operator */

/** The quote inbox: everything this operator has been asked about. */
export async function operatorInbox(operatorId: string) {
  return db()
    .select({ quote, request: tripRequest, customerName: customer.name })
    .from(quote)
    .innerJoin(tripRequest, eq(quote.tripRequestId, tripRequest.id))
    .innerJoin(customer, eq(tripRequest.customerId, customer.id))
    .where(
      and(
        eq(quote.operatorId, operatorId),
        inArray(quote.status, ["requested", "submitted", "accepted"]),
      ),
    )
    .orderBy(desc(quote.requestedAt))
}

export async function operatorQuote(operatorId: string, quoteId: string) {
  const rows = await db()
    .select({ quote, request: tripRequest, customerName: customer.name })
    .from(quote)
    .innerJoin(tripRequest, eq(quote.tripRequestId, tripRequest.id))
    .innerJoin(customer, eq(tripRequest.customerId, customer.id))
    .where(and(eq(quote.id, quoteId), eq(quote.operatorId, operatorId)))
    .limit(1)

  if (!rows[0]) return null

  const stops = await db()
    .select()
    .from(stop)
    .where(eq(stop.tripRequestId, rows[0].request.id))
    .orderBy(stop.sequence)

  return { ...rows[0], stops }
}

export async function operatorFleet(operatorId: string, asOf = new Date()) {
  const vehicles = await db()
    .select()
    .from(vehicle)
    .where(eq(vehicle.operatorId, operatorId))
    .orderBy(vehicle.registrationNumber)

  const documents =
    vehicles.length === 0
      ? []
      : await db()
          .select()
          .from(vehicleDocument)
          .where(
            inArray(
              vehicleDocument.vehicleId,
              vehicles.map((row) => row.id),
            ),
          )

  return vehicles.map((row) => {
    const owned = documents.filter((entry) => entry.vehicleId === row.id)
    return {
      ...row,
      documents: owned,
      compliance: assessVehicle({
        documents: owned.map((entry) => ({
          kind: entry.kind,
          expiresOn: entry.expiresOn,
          verification: entry.verification,
        })),
        yearOfManufacture: row.yearOfManufacture,
        asOf,
      }),
    }
  })
}

/** Confirmed work, and what each trip pays. */
export async function operatorEarnings(operatorId: string) {
  return db()
    .select({ booking, request: tripRequest, settlement, customerName: customer.name })
    .from(booking)
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .innerJoin(customer, eq(booking.customerId, customer.id))
    .leftJoin(settlement, eq(settlement.bookingId, booking.id))
    .where(eq(booking.operatorId, operatorId))
    .orderBy(desc(booking.createdAt))
}

export async function operatorDrivers(operatorId: string) {
  return db().select().from(driver).where(eq(driver.operatorId, operatorId)).orderBy(driver.name)
}

/* --------------------------------------------------------------- driver */

/**
 * Today, for a driver — and nothing about money.
 *
 * The projection is explicit rather than `select()`: it is easier to see that
 * no price is in it, and a column added to `booking` later cannot leak into a
 * driver's screen by accident.
 */
export type DriverTrip = {
  bookingId: string
  reference: string
  status: string
  startAt: Date
  passengerCount: number
  city: string
  interstate: boolean
  notes: string | null
  registration: string
  seats: number
  customerName: string
  customerPhone: string
  stops: { label: string; sequence: number }[]
  events: { kind: string; at: Date; detail: string | null }[]
  trackingToken: string
}

export async function driverTrips(driverId: string, now = new Date()): Promise<DriverTrip[]> {
  const rows = await db()
    .select({
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      trackingToken: booking.trackingToken,
      startAt: tripRequest.startAt,
      passengerCount: tripRequest.passengerCount,
      city: tripRequest.city,
      interstate: tripRequest.interstate,
      notes: tripRequest.notes,
      tripRequestId: tripRequest.id,
      registration: vehicle.registrationNumber,
      seats: vehicle.seats,
      customerName: customer.name,
      customerPhone: customer.phone,
    })
    .from(assignment)
    .innerJoin(booking, eq(assignment.bookingId, booking.id))
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .innerJoin(vehicle, eq(assignment.vehicleId, vehicle.id))
    .innerJoin(customer, eq(booking.customerId, customer.id))
    .where(
      and(
        eq(assignment.driverId, driverId),
        inArray(booking.status, ["assigned", "in_transit", "completed"]),
        // Yesterday onwards: a trip that ran last night may still need its
        // closing odometer, and one from March is not this screen's business.
        or(
          gte(tripRequest.startAt, new Date(now.getTime() - 36 * 3_600_000)),
          eq(booking.status, "in_transit"),
        ),
      ),
    )
    .orderBy(tripRequest.startAt)

  if (rows.length === 0) return []

  const [stops, events] = await Promise.all([
    db()
      .select()
      .from(stop)
      .where(
        inArray(
          stop.tripRequestId,
          rows.map((row) => row.tripRequestId),
        ),
      )
      .orderBy(stop.sequence),
    db()
      .select()
      .from(tripEvent)
      .where(
        inArray(
          tripEvent.bookingId,
          rows.map((row) => row.bookingId),
        ),
      )
      .orderBy(tripEvent.at),
  ])

  return rows.map((row) => ({
    bookingId: row.bookingId,
    reference: row.reference,
    status: row.status,
    startAt: row.startAt,
    passengerCount: row.passengerCount,
    city: row.city,
    interstate: row.interstate,
    notes: row.notes,
    registration: row.registration,
    seats: row.seats,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    trackingToken: row.trackingToken,
    stops: stops
      .filter((entry) => entry.tripRequestId === row.tripRequestId)
      .map((entry) => ({ label: entry.label, sequence: entry.sequence })),
    events: events
      .filter((entry) => entry.bookingId === row.bookingId)
      .map((entry) => ({ kind: entry.kind, at: entry.at, detail: entry.detail })),
  }))
}

/** Whether this driver is on this booking — the check every driver action makes. */
export async function driverOwnsBooking(driverId: string, bookingId: string): Promise<boolean> {
  const rows = await db()
    .select({ id: assignment.id })
    .from(assignment)
    .where(and(eq(assignment.driverId, driverId), eq(assignment.bookingId, bookingId)))
    .limit(1)

  return rows.length > 0
}
