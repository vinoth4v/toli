import { and, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm"
import { db } from "@/db/client"
import { booking, customer, operator, quote, settlement, tripEvent, tripRequest } from "@/db/schema"
import {
  type MarketplaceHealth,
  marketplaceHealth,
  type OperationalTrust,
  operationalTrust,
} from "@/domain/metrics"
import { applyBps } from "@/domain/money"
import { complianceQueue } from "./supply"

/**
 * The control tower of §4.4, and §13's metrics behind it.
 *
 * Aggregation happens in application code rather than SQL. At Phase 1 volumes
 * — hundreds of requests a month in one city — that is a few hundred rows and
 * one round trip, and it means the dashboard and the unit tests compute every
 * rate through the same function in domain/metrics.ts. The day this is slow is
 * the day it moves into SQL, and the metric definitions stay where they are.
 */

const THIRTY_DAYS_MS = 30 * 86_400_000

export type Attention = {
  /** RFQs with no quote yet. §13: the supply gap, and the first thing to fix. */
  unquoted: { id: string; reference: string; city: string; startAt: Date; customerName: string }[]
  /** Quotes in, decision out. The ops desk's actual queue. */
  awaitingDecision: { id: string; reference: string; quotes: number; startAt: Date }[]
  /** Trips running or about to. */
  live: { id: string; reference: string; status: string; startAt: Date; operatorName: string }[]
  /** Documents expired or expiring, from the compliance rules. */
  complianceItems: number
  blockingComplianceItems: number
  /** Settlements built but not released, and released but not paid. */
  settlementsPending: number
  settlementsPendingPaise: number
}

export type Money = {
  gmvPaise: number
  commissionPaise: number
  bookings: number
  averageBookingPaise: number
}

export type Dashboard = {
  health: MarketplaceHealth
  trust: OperationalTrust
  money: Money
  attention: Attention
}

export async function loadDashboard(now = new Date()): Promise<Dashboard> {
  const since = new Date(now.getTime() - THIRTY_DAYS_MS)

  const requests = await db()
    .select({ request: tripRequest, customerName: customer.name })
    .from(tripRequest)
    .innerJoin(customer, eq(tripRequest.customerId, customer.id))
    .where(gte(tripRequest.createdAt, since))
    .orderBy(desc(tripRequest.createdAt))

  const requestIds = requests.map((row) => row.request.id)

  const quotes =
    requestIds.length === 0
      ? []
      : await db()
          .select({
            id: quote.id,
            tripRequestId: quote.tripRequestId,
            submittedAt: quote.submittedAt,
            status: quote.status,
          })
          .from(quote)
          .where(inArray(quote.tripRequestId, requestIds))

  const health = marketplaceHealth(
    requests.map((row) => ({
      createdAt: row.request.createdAt,
      quotedAt: quotes
        .filter((entry) => entry.tripRequestId === row.request.id && entry.submittedAt)
        .map((entry) => entry.submittedAt as Date),
      booked: row.request.status === "booked",
    })),
  )

  const bookings = await db()
    .select({ booking, request: tripRequest, operatorName: operator.name })
    .from(booking)
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .innerJoin(operator, eq(booking.operatorId, operator.id))
    .where(gte(booking.createdAt, since))
    .orderBy(desc(booking.createdAt))

  const bookingIds = bookings.map((row) => row.booking.id)

  const starts =
    bookingIds.length === 0
      ? []
      : await db()
          .select({ bookingId: tripEvent.bookingId, at: tripEvent.at, kind: tripEvent.kind })
          .from(tripEvent)
          .where(and(inArray(tripEvent.bookingId, bookingIds), eq(tripEvent.kind, "started")))

  const trust = operationalTrust(
    bookings.map((row) => ({
      scheduledStartAt: row.request.startAt,
      actualStartAt: starts.find((entry) => entry.bookingId === row.booking.id)?.at ?? null,
      cancelledByOperator: row.booking.status === "cancelled",
      // Without a dispute saying otherwise, the vehicle that turned up is the
      // one that was booked. A dispute of kind `wrong_vehicle` is what would
      // move this, and it is raised through the disputes flow.
      matchedBooking: true,
    })),
  )

  const billable = bookings.filter((row) => row.booking.status !== "cancelled")
  const gmvPaise = billable.reduce((total, row) => total + row.booking.agreedTotalPaise, 0)

  const money: Money = {
    gmvPaise,
    commissionPaise: billable.reduce(
      (total, row) => total + applyBps(row.booking.agreedTotalPaise, row.booking.commissionBps),
      0,
    ),
    bookings: billable.length,
    averageBookingPaise: billable.length === 0 ? 0 : Math.round(gmvPaise / billable.length),
  }

  const quotesByRequest = new Map<string, number>()
  for (const entry of quotes) {
    if (entry.status === "requested") continue
    quotesByRequest.set(entry.tripRequestId, (quotesByRequest.get(entry.tripRequestId) ?? 0) + 1)
  }

  const open = requests.filter(
    (row) => row.request.status === "open" || row.request.status === "quoting",
  )

  const compliance = await complianceQueue(now)

  const pendingSettlements = await db()
    .select({ settlement })
    .from(settlement)
    .where(inArray(settlement.status, ["pending", "released"]))

  const upcoming = await db()
    .select({ booking, request: tripRequest, operatorName: operator.name })
    .from(booking)
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .innerJoin(operator, eq(booking.operatorId, operator.id))
    .where(
      and(
        inArray(booking.status, ["confirmed", "assigned", "in_transit"]),
        isNull(booking.cancelledAt),
        // Anything departing within the next week, plus anything already out.
        lt(tripRequest.startAt, new Date(now.getTime() + 7 * 86_400_000)),
      ),
    )
    .orderBy(tripRequest.startAt)
    .limit(10)

  return {
    health,
    trust,
    money,
    attention: {
      unquoted: open
        .filter((row) => (quotesByRequest.get(row.request.id) ?? 0) === 0)
        .slice(0, 8)
        .map((row) => ({
          id: row.request.id,
          reference: row.request.reference,
          city: row.request.city,
          startAt: row.request.startAt,
          customerName: row.customerName,
        })),
      awaitingDecision: open
        .filter((row) => (quotesByRequest.get(row.request.id) ?? 0) > 0)
        .slice(0, 8)
        .map((row) => ({
          id: row.request.id,
          reference: row.request.reference,
          quotes: quotesByRequest.get(row.request.id) ?? 0,
          startAt: row.request.startAt,
        })),
      live: upcoming.map((row) => ({
        id: row.booking.id,
        reference: row.booking.reference,
        status: row.booking.status,
        startAt: row.request.startAt,
        operatorName: row.operatorName,
      })),
      complianceItems: compliance.length,
      blockingComplianceItems: compliance.filter(
        (item) => item.bucket === "expired" || item.bucket === "missing",
      ).length,
      settlementsPending: pendingSettlements.length,
      settlementsPendingPaise: pendingSettlements.reduce(
        (total, row) => total + row.settlement.netPayablePaise,
        0,
      ),
    },
  }
}
