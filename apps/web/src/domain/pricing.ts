/**
 * The pricing engine (§7) and the money split that follows from it (§8).
 *
 * Pure: no database, no clock, no environment. Every quote in the app is this
 * function's output, so a fare can always be re-derived from its inputs and a
 * customer arguing about a number can be answered line by line.
 */

import { applyBps } from "@/domain/money"
import { RATE_CARDS, type VehicleClass } from "@/domain/vehicles"

export const TRIP_TYPES = ["one_way", "round_trip", "multi_day", "local_hourly"] as const

export type TripType = (typeof TRIP_TYPES)[number]

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  one_way: "One way (drop)",
  round_trip: "Round trip",
  multi_day: "Multi-day tour",
  local_hourly: "Local / hourly",
}

/**
 * GST on passenger transport is a choice between two regimes, not a rate to
 * look up (§8.3): 5% with no input tax credit, or 12% with it. Which one an
 * operator is better off under depends on their own input costs, so the app
 * stores the rate on each quote rather than assuming one nationally.
 *
 * Verify with a CA before this drives a real invoice.
 */
export const GST_RATES = [500, 1200] as const

export type GstRateBps = (typeof GST_RATES)[number]

export const GST_LABELS: Record<GstRateBps, string> = {
  500: "5% — no input tax credit",
  1200: "12% — with input tax credit",
}

/** Default marketplace take rate, in basis points. */
export const DEFAULT_COMMISSION_BPS = 1200

/**
 * A daily kilometre floor applies whenever the vehicle stays with the group.
 * On a one-way drop it does not: the vehicle is released at the destination and
 * the operator prices the empty return into their per-km rate, so charging a
 * 250 km floor on an 80 km drop would be double-counting.
 */
export function hasDailyMinimum(tripType: TripType): boolean {
  return tripType !== "one_way"
}

export type QuoteInput = {
  readonly vehicleClass: VehicleClass
  readonly tripType: TripType
  /** Total distance for the whole trip, both legs included. */
  readonly estimatedKm: number
  /** Calendar days the vehicle is engaged; at least 1. */
  readonly days: number
  /** Operator's own per-km rate, when it differs from the class default. */
  readonly perKmPaiseOverride?: number | null
  /** Tolls, state permits and parking, passed through at cost. */
  readonly tollsParkingPaise?: number
  readonly gstRateBps?: GstRateBps
  readonly commissionBps?: number
}

export type QuoteBreakdown = {
  readonly perKmPaise: number
  readonly chargeableKm: number
  readonly minimumKmApplied: boolean
  readonly nights: number
  readonly baseFarePaise: number
  readonly driverAllowancePaise: number
  readonly nightHaltPaise: number
  readonly tollsParkingPaise: number
  /** Fare before tax. Commission and GST are both taken from this. */
  readonly subtotalPaise: number
  readonly gstRateBps: number
  readonly gstPaise: number
  /** What the customer pays. */
  readonly totalPaise: number
  readonly commissionBps: number
  readonly commissionPaise: number
  /** What the operator is owed once the trip is done. */
  readonly operatorPayoutPaise: number
}

/**
 * Build a fare from a trip.
 *
 * Commission is taken on the fare excluding GST, not on the total — the tax is
 * collected on the operator's behalf and passed on, so treating it as revenue
 * to take a cut of would be charging the operator for their own tax.
 */
export function computeQuote(input: QuoteInput): QuoteBreakdown {
  const card = RATE_CARDS[input.vehicleClass]

  const days = Math.max(1, Math.trunc(input.days))
  const estimatedKm = Math.max(0, Math.round(input.estimatedKm))
  const perKmPaise =
    input.perKmPaiseOverride && input.perKmPaiseOverride > 0
      ? Math.round(input.perKmPaiseOverride)
      : card.perKmPaise

  const floorKm = hasDailyMinimum(input.tripType) ? card.minimumKmPerDay * days : 0
  const chargeableKm = Math.max(estimatedKm, floorKm)
  const nights = input.tripType === "one_way" ? 0 : days - 1

  const baseFarePaise = chargeableKm * perKmPaise
  const driverAllowancePaise = card.driverAllowancePerDayPaise * days
  const nightHaltPaise = card.nightHaltPaise * nights
  const tollsParkingPaise = Math.max(0, Math.round(input.tollsParkingPaise ?? 0))

  const subtotalPaise =
    baseFarePaise + driverAllowancePaise + nightHaltPaise + tollsParkingPaise

  const gstRateBps = input.gstRateBps ?? GST_RATES[0]
  const gstPaise = applyBps(subtotalPaise, gstRateBps)

  const commissionBps = input.commissionBps ?? DEFAULT_COMMISSION_BPS
  const commissionPaise = applyBps(subtotalPaise, commissionBps)

  return {
    perKmPaise,
    chargeableKm,
    minimumKmApplied: chargeableKm > estimatedKm,
    nights,
    baseFarePaise,
    driverAllowancePaise,
    nightHaltPaise,
    tollsParkingPaise,
    subtotalPaise,
    gstRateBps,
    gstPaise,
    totalPaise: subtotalPaise + gstPaise,
    commissionBps,
    commissionPaise,
    operatorPayoutPaise: subtotalPaise - commissionPaise,
  }
}

/**
 * The advance a customer pays to hold the vehicle: a quarter of the fare,
 * rounded up to the nearest ₹100 so the number on the payment link is one a
 * person can read back over a phone.
 */
export function advanceDuePaise(totalPaise: number): number {
  const quarter = Math.ceil(totalPaise / 4)
  const rounded = Math.ceil(quarter / 10_000) * 10_000
  // Rounding up must never ask for more than the trip costs.
  return Math.min(rounded, Math.max(0, totalPaise))
}

/** Line items, in invoice order — what the quote page and any PDF both render. */
export function quoteLines(
  breakdown: QuoteBreakdown,
): ReadonlyArray<{ label: string; paise: number }> {
  const lines = [
    {
      label: `${breakdown.chargeableKm} km × ₹${(breakdown.perKmPaise / 100).toFixed(2)}/km`,
      paise: breakdown.baseFarePaise,
    },
    { label: "Driver allowance", paise: breakdown.driverAllowancePaise },
  ]

  if (breakdown.nightHaltPaise > 0) {
    lines.push({
      label: `Night halt × ${breakdown.nights}`,
      paise: breakdown.nightHaltPaise,
    })
  }
  if (breakdown.tollsParkingPaise > 0) {
    lines.push({ label: "Tolls, permits and parking", paise: breakdown.tollsParkingPaise })
  }

  return lines
}
