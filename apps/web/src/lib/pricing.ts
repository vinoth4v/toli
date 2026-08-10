// Relative, with the extension, because the unit tests import this module
// directly and vitest is not given the "@/" alias.
import { applyBps } from "./money.ts"

/**
 * Toli Fair Price — the reason this app exists.
 *
 * Two charter quotes are almost never comparable as spoken. One is "₹32,000
 * for the trip" with 1,200 km included and tolls on the customer; the other
 * is "₹28,000" with 800 km included, ₹18/km after, driver bata extra, and a
 * permit nobody mentioned. The second one is more expensive. This module is
 * where that is worked out, once, from the trip's own numbers — so the desk
 * compares landed cost rather than opening bids.
 */

/** The trip, reduced to the four numbers that price it. */
export type TripShape = {
  /** Calendar days the vehicle is engaged, inclusive of both ends. */
  days: number
  /** Nights the driver is away from base — days minus one, never negative. */
  nights: number
  /** The desk's running-kilometre estimate for the whole trip. */
  estimatedKm: number
  passengers: number
}

/** A quote's commercial terms. Mirrors the quote table, minus its identity. */
export type QuoteTerms = {
  baseFarePaise: number
  includedKm: number
  perKmPaise: number
  driverBataPaise: number
  nightHaltPaise: number
  tollsIncluded: boolean
  tollsPaise: number
  parkingIncluded: boolean
  parkingPaise: number
  permitIncluded: boolean
  permitPaise: number
}

export type PriceLine = {
  label: string
  amountPaise: number
  /** How the number was arrived at, in the customer's own terms. */
  note: string
}

export type PricedQuote = {
  lines: PriceLine[]
  /** Kilometres beyond the quote's own included allowance. */
  extraKm: number
  allInPaise: number
  perPassengerPaise: number
  perDayPaise: number
}

/** Advance taken at booking. A quarter is the market norm for charter. */
export const DEFAULT_ADVANCE_BPS = 2500

/**
 * What a travel agent takes for forwarding a phone number: 15–25%. Shown
 * beside Toli's own commission because "we charge less than the agent" is
 * the entire supply-side pitch, and a claim like that should be arithmetic
 * on the screen rather than a line in a deck.
 */
export const AGENT_COMMISSION_BPS = 2000

/**
 * Days and nights from two ISO dates.
 *
 * Inclusive of both ends: a vehicle booked for the 3rd to the 5th is engaged
 * for three days, not two. Nights is one fewer, because the driver sleeps
 * away from base on every night but the last day's end.
 */
export function tripDuration(startDate: string, endDate: string): { days: number; nights: number } {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)

  if (Number.isNaN(start) || Number.isNaN(end)) return { days: 1, nights: 0 }

  const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1)
  return { days, nights: days - 1 }
}

/**
 * Price one quote against one trip, itemised.
 *
 * Every line is returned even when it is zero, because "tolls: included" and
 * "tolls: ₹0" are different claims and the customer is entitled to see which
 * one they were given.
 */
export function priceQuote(trip: TripShape, terms: QuoteTerms): PricedQuote {
  const extraKm = Math.max(0, trip.estimatedKm - terms.includedKm)

  const lines: PriceLine[] = [
    {
      label: "Base fare",
      amountPaise: terms.baseFarePaise,
      note: `${terms.includedKm.toLocaleString("en-IN")} km included over ${trip.days} day${
        trip.days === 1 ? "" : "s"
      }`,
    },
    {
      label: "Extra kilometres",
      amountPaise: extraKm * terms.perKmPaise,
      note:
        extraKm === 0
          ? `Trip estimate of ${trip.estimatedKm.toLocaleString("en-IN")} km is inside the allowance`
          : `${extraKm.toLocaleString("en-IN")} km beyond the allowance`,
    },
    {
      label: "Driver bata",
      amountPaise: terms.driverBataPaise * trip.days,
      note: `${trip.days} day${trip.days === 1 ? "" : "s"}`,
    },
    {
      label: "Night halt",
      amountPaise: terms.nightHaltPaise * trip.nights,
      note: trip.nights === 0 ? "Same-day trip" : `${trip.nights} night${trip.nights === 1 ? "" : "s"}`,
    },
    {
      label: "Tolls",
      amountPaise: terms.tollsIncluded ? 0 : terms.tollsPaise,
      note: terms.tollsIncluded ? "Included in the fare" : "Charged on top",
    },
    {
      label: "Parking",
      amountPaise: terms.parkingIncluded ? 0 : terms.parkingPaise,
      note: terms.parkingIncluded ? "Included in the fare" : "Charged on top",
    },
    {
      label: "Interstate permit",
      amountPaise: terms.permitIncluded ? 0 : terms.permitPaise,
      note: terms.permitIncluded ? "Included in the fare" : "Charged on top",
    },
  ]

  const allInPaise = lines.reduce((total, line) => total + line.amountPaise, 0)
  const passengers = Math.max(1, trip.passengers)

  return {
    lines,
    extraKm,
    allInPaise,
    perPassengerPaise: Math.round(allInPaise / passengers),
    perDayPaise: Math.round(allInPaise / Math.max(1, trip.days)),
  }
}

/** The advance due at booking, and what is left to settle on the day. */
export function splitAdvance(
  allInPaise: number,
  bps: number = DEFAULT_ADVANCE_BPS,
): { advancePaise: number; balancePaise: number } {
  const advancePaise = applyBps(allInPaise, bps)
  return { advancePaise, balancePaise: allInPaise - advancePaise }
}

/** What Toli keeps, and what the operator is settled — at T+2, not T+90. */
export function settlement(
  allInPaise: number,
  commissionBps: number,
): { commissionPaise: number; operatorPayoutPaise: number; agentWouldHaveTakenPaise: number } {
  const commissionPaise = applyBps(allInPaise, commissionBps)
  return {
    commissionPaise,
    operatorPayoutPaise: allInPaise - commissionPaise,
    agentWouldHaveTakenPaise: applyBps(allInPaise, AGENT_COMMISSION_BPS),
  }
}

export type RankedQuote<T extends QuoteTerms> = {
  quote: T
  priced: PricedQuote
  /** 1 is the cheapest all-in, whatever its headline base fare said. */
  rank: number
  /** Paise more than the cheapest quote. Zero for the cheapest itself. */
  deltaPaise: number
}

/**
 * Rank quotes by landed cost, cheapest first.
 *
 * Ties keep their input order, so a re-render cannot silently reshuffle two
 * identical quotes under the operator's cursor.
 */
export function rankQuotes<T extends QuoteTerms>(trip: TripShape, quotes: T[]): RankedQuote<T>[] {
  const priced = quotes.map((quote) => ({ quote, priced: priceQuote(trip, quote) }))
  const sorted = [...priced].sort((a, b) => a.priced.allInPaise - b.priced.allInPaise)

  const cheapest = sorted[0]?.priced.allInPaise ?? 0

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    deltaPaise: entry.priced.allInPaise - cheapest,
  }))
}
