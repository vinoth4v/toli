import { and, eq, gte, inArray, lte, or } from "drizzle-orm"
import { db } from "@/db/client"
import {
  assignment,
  booking,
  driver,
  operator,
  rateCard,
  tripRequest,
  vehicle,
  vehicleDocument,
} from "@/db/schema"
import { assessVehicle } from "@/domain/compliance"
import { priceQuote, type QuoteTerms, type TripShape } from "@/domain/quote"
import { type Segment, satisfies } from "@/domain/segment"

/**
 * Lane B — what can actually carry this group, today, at a price now.
 *
 * §11 puts instant book in Phase 2 and is precise about what makes it possible:
 * standing rate cards, so the platform can quote on an operator's behalf
 * without waiting for them to answer. Everything here is that idea — find the
 * vehicles that are free, compliant and good enough for the segment asked for,
 * and price each one from its operator's own card.
 *
 * The filters are not a ranking nicety. A vehicle that appears here can be
 * booked in one tap, so anything unfit must be excluded *before* the customer
 * sees it — an expired permit discovered after payment is worse than one that
 * was never offered.
 */

export type Offer = {
  vehicleId: string
  registrationNumber: string
  seats: number
  vehicleClass: string
  segment: Segment
  yearOfManufacture: number
  features: string[]
  operatorId: string
  operatorName: string
  operatorTier: string
  driverId: string | null
  driverName: string | null
  /** True when this driver speaks the language the customer asked for. */
  driverSpeaksRequested: boolean
  /** Priced from the operator's standing card, in the §7.1 shape. */
  terms: QuoteTerms
  estimatedTotalPaise: number
  worstCaseTotalPaise: number
  chargeableKm: number
  minimumKmShortfall: number
}

export type AvailabilityQuery = {
  city: string
  segment: Segment
  passengers: number
  startAt: Date
  endAt: Date | null
  estimatedKm: number
  interstate: boolean
  stateCount: number
  /** A locale code the customer asked the driver to speak. */
  driverLanguage?: string | null
}

/**
 * Vehicles already committed in the window.
 *
 * A charter is not an hourly rental: a vehicle leaving for Kodaikanal at 6 AM
 * is gone all day, and often overnight. So the test is whether the requested
 * window overlaps a booked trip's window at all, with the booked trip's end
 * defaulting to its start when it is a one-way — a vehicle is never free the
 * same morning it departs.
 */
async function committedVehicleIds(startAt: Date, endAt: Date | null): Promise<Set<string>> {
  const windowEnd = endAt ?? startAt
  // A day either side: a vehicle finishing in Rameswaram at 9 PM is not
  // starting from Madurai at 7 the next morning without a repositioning run.
  const from = new Date(startAt.getTime() - 12 * 3_600_000)
  const to = new Date(windowEnd.getTime() + 12 * 3_600_000)

  const rows = await db()
    .select({ vehicleId: assignment.vehicleId })
    .from(assignment)
    .innerJoin(booking, eq(assignment.bookingId, booking.id))
    .innerJoin(tripRequest, eq(booking.tripRequestId, tripRequest.id))
    .where(
      and(
        inArray(booking.status, ["confirmed", "assigned", "in_transit"]),
        or(
          and(gte(tripRequest.startAt, from), lte(tripRequest.startAt, to)),
          and(gte(tripRequest.endAt, from), lte(tripRequest.endAt, to)),
        ),
      ),
    )

  return new Set(rows.map((row) => row.vehicleId))
}

export async function findOffers(query: AvailabilityQuery): Promise<Offer[]> {
  const rows = await db()
    .select({ vehicle, operator })
    .from(vehicle)
    .innerJoin(operator, eq(vehicle.operatorId, operator.id))
    .where(and(eq(vehicle.status, "active"), eq(operator.status, "active")))

  if (rows.length === 0) return []

  const [documents, cards, drivers, committed] = await Promise.all([
    db()
      .select()
      .from(vehicleDocument)
      .where(
        inArray(
          vehicleDocument.vehicleId,
          rows.map((row) => row.vehicle.id),
        ),
      ),
    db().select().from(rateCard).where(eq(rateCard.active, true)),
    db().select().from(driver).where(eq(driver.verification, "verified")),
    committedVehicleIds(query.startAt, query.endAt),
  ])

  const days = query.endAt
    ? Math.max(1, Math.ceil((query.endAt.getTime() - query.startAt.getTime()) / 86_400_000))
    : 1
  const nights = Math.max(0, days - 1)

  const shape: TripShape = {
    tripType: query.endAt ? "round_trip" : "one_way",
    days,
    nights,
    estimatedKm: query.estimatedKm,
    estimatedHours: Math.max(days * 8, Math.round(query.estimatedKm / 35)),
    interstate: query.interstate,
    stateCount: query.stateCount,
  }

  const offers: Offer[] = []

  for (const row of rows) {
    const { vehicle: found, operator: owner } = row

    if (committed.has(found.id)) continue
    if (found.seats < query.passengers) continue
    if (owner.city !== query.city) continue
    if (!satisfies({ ac: found.ac, features: found.features }, query.segment)) continue

    // Compliance is judged against the day of travel, and a vehicle that
    // cannot legally do this trip is never shown — not shown and then refused.
    const owned = documents.filter((entry) => entry.vehicleId === found.id)
    const compliance = assessVehicle({
      documents: owned.map((entry) => ({
        kind: entry.kind,
        expiresOn: entry.expiresOn,
        verification: entry.verification,
      })),
      yearOfManufacture: found.yearOfManufacture,
      asOf: query.startAt,
    })

    if (!compliance.fitForService) continue
    if (query.interstate && !compliance.fitForInterstate) continue

    // The operator must have a standing price for this segment and class;
    // without one they are an RFQ operator, not an instant-book one.
    const card = cards.find(
      (entry) =>
        entry.operatorId === owner.id &&
        entry.segment === found.segment &&
        entry.vehicleClass === found.vehicleClass,
    )
    if (!card) continue

    const terms: QuoteTerms = {
      baseFarePaise: card.baseFarePaise,
      includedKm: card.includedKm,
      includedHours: card.includedHours,
      extraKmRatePaise: card.extraKmRatePaise,
      extraHourRatePaise: card.extraHourRatePaise,
      perKmRatePaise: card.perKmRatePaise,
      minKmPerDay: card.minKmPerDay,
      driverBataPerDayPaise: card.driverBataPerDayPaise,
      nightHaltPaise: card.nightHaltPaise,
      tollIncluded: card.tollIncluded,
      parkingIncluded: card.parkingIncluded,
      statePermitIncluded: card.statePermitIncluded,
      fuelIncluded: true,
      gstTreatment: "passenger_transport_5",
    }

    const priced = priceQuote(terms, shape)

    // A driver who speaks the language asked for is picked first. §4.1 lets a
    // customer ask; honouring it where possible is the difference between a
    // preference and a checkbox nobody reads.
    const crewForOperator = drivers.filter((entry) => entry.operatorId === owner.id)
    const speaking = query.driverLanguage
      ? crewForOperator.find((entry) => entry.languages.includes(query.driverLanguage as string))
      : undefined
    const crew = speaking ?? crewForOperator[0] ?? null

    offers.push({
      vehicleId: found.id,
      registrationNumber: found.registrationNumber,
      seats: found.seats,
      vehicleClass: found.vehicleClass,
      segment: found.segment,
      yearOfManufacture: found.yearOfManufacture,
      features: found.features,
      operatorId: owner.id,
      operatorName: owner.name,
      operatorTier: owner.tier,
      driverId: crew?.id ?? null,
      driverName: crew?.name ?? null,
      driverSpeaksRequested: Boolean(speaking),
      terms,
      estimatedTotalPaise: priced.estimatedTotalPaise,
      worstCaseTotalPaise: priced.worstCaseTotalPaise,
      chargeableKm: priced.chargeableKm,
      minimumKmShortfall: priced.minimumKmShortfall,
    })
  }

  // Cheapest first — with a vehicle that seats the group exactly preferred over
  // a needlessly large one at the same price.
  return offers.sort(
    (a, b) =>
      Number(b.driverSpeaksRequested) - Number(a.driverSpeaksRequested) ||
      a.estimatedTotalPaise - b.estimatedTotalPaise ||
      a.seats - b.seats,
  )
}

export type { TripShape }
