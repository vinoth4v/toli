import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { type RateCard, rateCard } from "@/db/schema"
import type { Segment } from "@/domain/segment"
import type { VehicleClass } from "@/domain/vehicle"

/**
 * An operator's standing prices.
 *
 * §4.2 calls this rate card mode and is explicit about why it matters: it
 * "dramatically raises response rate, which is the metric that kills
 * marketplaces". An operator who sets these once is quotable while they are
 * driving, asleep, or ignoring their phone — and Lane B cannot exist without
 * them at all.
 *
 * Every write is scoped by operator id from the session. There is no function
 * here that can edit somebody else's prices.
 */

export async function ratesFor(operatorId: string): Promise<RateCard[]> {
  return db()
    .select()
    .from(rateCard)
    .where(eq(rateCard.operatorId, operatorId))
    .orderBy(asc(rateCard.segment), asc(rateCard.vehicleClass))
}

export type RateInput = {
  operatorId: string
  segment: Segment
  vehicleClass: VehicleClass
  perKmRatePaise: number
  minKmPerDay: number
  baseFarePaise: number
  driverBataPerDayPaise: number
  nightHaltPaise: number
  tollIncluded: boolean
  parkingIncluded: boolean
  statePermitIncluded: boolean
  active: boolean
}

/**
 * Saves a rate, replacing any existing one for the same segment and class.
 *
 * Upsert rather than insert-or-fail: an operator editing yesterday's price is
 * the common case, and the unique index on (operator, segment, class) is what
 * makes "one standing price per thing I sell" true rather than aspirational.
 */
export async function saveRate(input: RateInput): Promise<void> {
  const { operatorId, segment, vehicleClass, ...values } = input

  await db()
    .insert(rateCard)
    .values({ operatorId, segment, vehicleClass, ...values })
    .onConflictDoUpdate({
      target: [rateCard.operatorId, rateCard.segment, rateCard.vehicleClass],
      set: { ...values, updatedAt: new Date() },
    })
}

/** Withdrawing a price stops instant bookings without deleting the history. */
export async function setRateActive(
  operatorId: string,
  id: string,
  active: boolean,
): Promise<void> {
  await db()
    .update(rateCard)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(rateCard.id, id), eq(rateCard.operatorId, operatorId)))
}
