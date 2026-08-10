import { and, asc, desc, eq, sql } from "drizzle-orm"
import { db } from "@/db/client"
import {
  type BookingRow,
  bookings,
  charterRequests,
  type CharterRequestRow,
  type OperatorRow,
  operators,
  type QuoteRow,
  quotes,
  type VehicleRow,
  vehicles,
} from "@/db/schema"

/**
 * Every read the app does, in one place.
 *
 * Joins are deliberately shallow — a second query and a merge in JavaScript,
 * rather than a five-table join whose types nobody can follow. The whole
 * dataset here is one city's worth of fleets, and the desk is one person.
 */

export type OperatorWithVehicles = OperatorRow & { vehicles: VehicleRow[] }

export async function listOperatorsWithVehicles(): Promise<OperatorWithVehicles[]> {
  const [operatorRows, vehicleRows] = await Promise.all([
    db().select().from(operators).orderBy(desc(operators.verified), asc(operators.name)),
    db().select().from(vehicles).orderBy(desc(vehicles.seats)),
  ])

  return operatorRows.map((operator) => ({
    ...operator,
    vehicles: vehicleRows.filter((vehicle) => vehicle.operatorId === operator.id),
  }))
}

export async function getOperator(id: string): Promise<OperatorWithVehicles | null> {
  const [operator] = await db().select().from(operators).where(eq(operators.id, id)).limit(1)
  if (!operator) return null

  const fleet = await db()
    .select()
    .from(vehicles)
    .where(eq(vehicles.operatorId, id))
    .orderBy(desc(vehicles.active), desc(vehicles.seats))

  return { ...operator, vehicles: fleet }
}

export type RequestSummary = CharterRequestRow & { quoteCount: number }

export async function listRequests(status?: string): Promise<RequestSummary[]> {
  const requestRows = status
    ? await db()
        .select()
        .from(charterRequests)
        .where(eq(charterRequests.status, status))
        .orderBy(asc(charterRequests.startDate))
    : await db().select().from(charterRequests).orderBy(desc(charterRequests.createdAt))

  const counts = await db()
    .select({ requestId: quotes.requestId, total: sql<number>`count(*)::int` })
    .from(quotes)
    .groupBy(quotes.requestId)

  return requestRows.map((request) => ({
    ...request,
    quoteCount: counts.find((row) => row.requestId === request.id)?.total ?? 0,
  }))
}

export async function getRequest(id: string): Promise<CharterRequestRow | null> {
  const [request] = await db().select().from(charterRequests).where(eq(charterRequests.id, id)).limit(1)
  return request ?? null
}

export type QuoteWithOperator = QuoteRow & {
  operatorName: string
  operatorPhone: string
  operatorVerified: boolean
  operatorCommissionBps: number
}

export async function listQuotes(requestId: string): Promise<QuoteWithOperator[]> {
  const rows = await db()
    .select({
      quote: quotes,
      operatorName: operators.name,
      operatorPhone: operators.phone,
      operatorVerified: operators.verified,
      operatorCommissionBps: operators.commissionBps,
    })
    .from(quotes)
    .innerJoin(operators, eq(quotes.operatorId, operators.id))
    .where(eq(quotes.requestId, requestId))
    .orderBy(asc(quotes.createdAt))

  return rows.map((row) => ({
    ...row.quote,
    operatorName: row.operatorName,
    operatorPhone: row.operatorPhone,
    operatorVerified: row.operatorVerified,
    operatorCommissionBps: row.operatorCommissionBps,
  }))
}

export type BookingWithContext = {
  booking: BookingRow
  request: CharterRequestRow
  operatorName: string
  operatorPhone: string
}

export async function listBookings(): Promise<BookingWithContext[]> {
  const rows = await db()
    .select({
      booking: bookings,
      request: charterRequests,
      operatorName: operators.name,
      operatorPhone: operators.phone,
    })
    .from(bookings)
    .innerJoin(charterRequests, eq(bookings.requestId, charterRequests.id))
    .innerJoin(operators, eq(bookings.operatorId, operators.id))
    .orderBy(asc(charterRequests.startDate))

  return rows
}

export async function getBookingForRequest(requestId: string): Promise<BookingWithContext | null> {
  const [row] = await db()
    .select({
      booking: bookings,
      request: charterRequests,
      operatorName: operators.name,
      operatorPhone: operators.phone,
    })
    .from(bookings)
    .innerJoin(charterRequests, eq(bookings.requestId, charterRequests.id))
    .innerJoin(operators, eq(bookings.operatorId, operators.id))
    .where(eq(bookings.requestId, requestId))
    .limit(1)

  return row ?? null
}

export type DeskSummary = {
  openRequests: number
  quotesIn: number
  verifiedVehicles: number
  operatorCount: number
  confirmedBookings: number
  bookedValuePaise: number
  commissionPaise: number
}

/** The six numbers on the desk. One query each, all in parallel. */
export async function deskSummary(): Promise<DeskSummary> {
  const [openRows, quoteRows, vehicleRows, operatorRows, bookingRows] = await Promise.all([
    db()
      .select({ total: sql<number>`count(*)::int` })
      .from(charterRequests)
      .where(eq(charterRequests.status, "open")),
    db()
      .select({ total: sql<number>`count(*)::int` })
      .from(quotes)
      .where(eq(quotes.status, "submitted")),
    db()
      .select({ total: sql<number>`count(*)::int` })
      .from(vehicles)
      .innerJoin(operators, eq(vehicles.operatorId, operators.id))
      .where(and(eq(vehicles.active, true), eq(operators.verified, true))),
    db()
      .select({ total: sql<number>`count(*)::int` })
      .from(operators),
    db()
      .select({
        total: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(${bookings.allInPaise}), 0)::int`,
        commission: sql<number>`coalesce(sum(${bookings.commissionPaise}), 0)::int`,
      })
      .from(bookings)
      .where(eq(bookings.status, "confirmed")),
  ])

  return {
    openRequests: openRows[0]?.total ?? 0,
    quotesIn: quoteRows[0]?.total ?? 0,
    verifiedVehicles: vehicleRows[0]?.total ?? 0,
    operatorCount: operatorRows[0]?.total ?? 0,
    confirmedBookings: bookingRows[0]?.total ?? 0,
    bookedValuePaise: bookingRows[0]?.value ?? 0,
    commissionPaise: bookingRows[0]?.commission ?? 0,
  }
}
