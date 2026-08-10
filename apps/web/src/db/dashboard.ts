import { and, count, eq, gte, inArray, ne, sum } from "drizzle-orm"
import { type BookingDetail, listBookings } from "@/db/bookings"
import { db } from "@/db/client"
import { OPEN_ENQUIRY_STATUSES } from "@/db/enquiries"
import { booking, enquiry, quote, transportOperator, vehicle } from "@/db/schema"

export type Dashboard = {
  openEnquiries: number
  quotesAwaitingReply: number
  liveBookings: number
  verifiedOperators: number
  activeVehicles: number
  /** Fare booked, tax included — what customers have committed to pay. */
  gmvPaise: number
  /** The marketplace's own share of that. */
  commissionPaise: number
  upcoming: BookingDetail[]
}

/** Postgres returns SUM as a string, and as null when nothing matched. */
function toPaise(value: string | null | undefined): number {
  return value == null ? 0 : Number(value)
}

/**
 * The numbers the home page opens with.
 *
 * Several small queries rather than one clever one: each is independently
 * readable, and at the volume a single operator handles the round trips cost
 * less than the next person's hour spent decoding a six-way join.
 */
export async function loadDashboard(): Promise<Dashboard> {
  const database = db()

  const [openEnquiries, quotesAwaitingReply, liveBookings, verifiedOperators, activeVehicles] =
    await Promise.all([
      database
        .select({ value: count() })
        .from(enquiry)
        .where(inArray(enquiry.status, [...OPEN_ENQUIRY_STATUSES])),
      database.select({ value: count() }).from(quote).where(eq(quote.status, "sent")),
      database
        .select({ value: count() })
        .from(booking)
        .where(inArray(booking.status, ["confirmed", "on_trip"])),
      database
        .select({ value: count() })
        .from(transportOperator)
        .where(eq(transportOperator.status, "verified")),
      database.select({ value: count() }).from(vehicle).where(eq(vehicle.active, true)),
    ])

  const money = await database
    .select({ gmv: sum(quote.totalPaise), commission: sum(quote.commissionPaise) })
    .from(booking)
    .innerJoin(quote, eq(booking.quoteId, quote.id))
    .where(ne(booking.status, "cancelled"))

  const upcoming = await loadUpcomingDepartures()

  return {
    openEnquiries: openEnquiries[0]?.value ?? 0,
    quotesAwaitingReply: quotesAwaitingReply[0]?.value ?? 0,
    liveBookings: liveBookings[0]?.value ?? 0,
    verifiedOperators: verifiedOperators[0]?.value ?? 0,
    activeVehicles: activeVehicles[0]?.value ?? 0,
    gmvPaise: toPaise(money[0]?.gmv),
    commissionPaise: toPaise(money[0]?.commission),
    upcoming,
  }
}

/** The next few vehicles to actually leave — the only truly urgent list here. */
async function loadUpcomingDepartures(limit = 5): Promise<BookingDetail[]> {
  return db()
    .select({ booking, quote, enquiry, operator: transportOperator })
    .from(booking)
    .innerJoin(quote, eq(booking.quoteId, quote.id))
    .innerJoin(enquiry, eq(booking.enquiryId, enquiry.id))
    .innerJoin(transportOperator, eq(quote.operatorId, transportOperator.id))
    .where(
      and(
        inArray(booking.status, ["confirmed", "on_trip"]),
        gte(enquiry.startAt, new Date(Date.now() - 12 * 60 * 60 * 1000)),
      ),
    )
    .orderBy(enquiry.startAt)
    .limit(limit)
}

/** Bookings whose trip has already started or passed, still not closed out. */
export async function listOverdueBookings(): Promise<BookingDetail[]> {
  const live = await listBookings(["confirmed", "on_trip"])
  const now = Date.now()
  return live.filter((row) => row.enquiry.startAt.getTime() < now)
}
