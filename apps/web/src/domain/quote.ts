import { computeGst, type GstTreatmentKey } from "./gst.ts"
import { formatPaise } from "./money.ts"
import type { TripType } from "./trip.ts"
import { pricingBasis } from "./trip.ts"

/**
 * The pricing engine — §7 of the build plan.
 *
 * The whole product thesis is here: quotes in this market are not comparable,
 * so Toli refuses to accept a free-text price. Every quote is the same set of
 * fields, and from those fields two numbers are computed and shown together —
 * what the trip should cost, and what it could cost if everything the operator
 * excluded actually happens.
 *
 * `minKmPerDay` and `statePermitIncluded` are the two that matter most. They
 * are the charges that turn a ₹28,000 quote into a ₹41,000 bill at the end of
 * a trip, and this file's job is to make both of them arithmetic instead of a
 * surprise.
 */

export type QuoteTerms = {
  baseFarePaise: number
  /** Local packages: what the base fare covers. */
  includedKm: number | null
  includedHours: number | null
  extraKmRatePaise: number | null
  extraHourRatePaise: number | null
  /** Outstation: charged per km on a minimum-daily-km basis. */
  perKmRatePaise: number | null
  minKmPerDay: number | null
  driverBataPerDayPaise: number
  nightHaltPaise: number
  tollIncluded: boolean
  parkingIncluded: boolean
  statePermitIncluded: boolean
  fuelIncluded: boolean
  gstTreatment: GstTreatmentKey
}

export type TripShape = {
  tripType: TripType
  days: number
  nights: number
  estimatedKm: number
  estimatedHours: number
  interstate: boolean
  /** States entered beyond the home state — each one can carry its own permit fee. */
  stateCount: number
}

/**
 * What the customer might additionally pay, and why.
 *
 * Deliberately itemised rather than folded into one number: "could be up to
 * ₹41,000" is frightening, while "₹41,000 if you cross into two states and
 * run 300 km over" is a decision the customer can act on — take fewer stops,
 * or pick the operator whose quote includes permits.
 */
export type WorstCaseItem = {
  label: string
  amountPaise: number
  reason: string
}

export type PricedQuote = {
  /** Kilometres actually charged for, after the minimum-per-day floor. */
  chargeableKm: number
  /** Kilometres billed but not travelled — the hidden charge, made visible. */
  minimumKmShortfall: number
  fareBeforeTaxPaise: number
  taxPaise: number
  estimatedTotalPaise: number
  worstCaseTotalPaise: number
  worstCaseItems: WorstCaseItem[]
  lines: { label: string; amountPaise: number; detail?: string }[]
}

/**
 * Allowances used only for the worst-case column, never to bill anybody.
 *
 * They are estimates of what an excluded charge typically costs, from the
 * ranges in §7.1 and §8.5. Being roughly right in public beats being exactly
 * silent: a customer who is told parking might add ₹150 a day and then pays
 * ₹200 is not surprised, and one who was told nothing is.
 */
export const WORST_CASE_ALLOWANCES = {
  tollPer100KmPaise: 25_000,
  parkingPerDayPaise: 15_000,
  statePermitPerStatePaise: 500_000,
  /** Routes run long: detours, a temple on the way, a hotel further out. */
  distanceOverrunFactor: 0.2,
} as const

function round(paise: number): number {
  return Math.round(paise)
}

/**
 * Prices a quote against a trip.
 *
 * Two bases, because this market has two: a *package* (8hr/80km local, airport
 * transfer) bills a base fare plus overage, while an *outstation* trip bills
 * per kilometre with a daily minimum. Which one applies is a property of the
 * trip type, not something an operator chooses — otherwise the comparison the
 * customer is making stops being like-for-like.
 */
export function priceQuote(terms: QuoteTerms, shape: TripShape): PricedQuote {
  const days = Math.max(1, shape.days)
  const nights = Math.max(0, shape.nights)
  const lines: { label: string; amountPaise: number; detail?: string }[] = []

  let fare = 0
  let chargeableKm = shape.estimatedKm
  let minimumKmShortfall = 0

  if (pricingBasis(shape.tripType) === "package") {
    const includedKm = terms.includedKm ?? 0
    const includedHours = terms.includedHours ?? 0
    const extraKm = Math.max(0, shape.estimatedKm - includedKm)
    const extraHours = Math.max(0, shape.estimatedHours - includedHours)

    fare += terms.baseFarePaise
    lines.push({
      label: "Base fare",
      amountPaise: terms.baseFarePaise,
      detail: `covers ${includedKm} km and ${includedHours} hours`,
    })

    if (extraKm > 0) {
      const amount = round(extraKm * (terms.extraKmRatePaise ?? 0))
      fare += amount
      lines.push({ label: "Extra kilometres", amountPaise: amount, detail: `${extraKm} km` })
    }
    if (extraHours > 0) {
      const amount = round(extraHours * (terms.extraHourRatePaise ?? 0))
      fare += amount
      lines.push({ label: "Extra hours", amountPaise: amount, detail: `${extraHours} hours` })
    }
    chargeableKm = Math.max(includedKm, shape.estimatedKm)
  } else {
    // The minimum-daily-km floor. An operator quoting ₹22/km with a 300 km/day
    // minimum on a 180 km/day trip is charging for 120 km/day nobody travels,
    // and the customer is entitled to see that as a line, not discover it later.
    const minimumKm = (terms.minKmPerDay ?? 0) * days
    chargeableKm = Math.max(shape.estimatedKm, minimumKm)
    minimumKmShortfall = Math.max(0, minimumKm - shape.estimatedKm)

    const distanceFare = round(chargeableKm * (terms.perKmRatePaise ?? 0))
    fare += terms.baseFarePaise + distanceFare
    if (terms.baseFarePaise > 0) {
      lines.push({ label: "Base fare", amountPaise: terms.baseFarePaise })
    }
    lines.push({
      label: "Distance",
      amountPaise: distanceFare,
      detail:
        minimumKmShortfall > 0
          ? `${chargeableKm} km charged (${shape.estimatedKm} km travelled, ${terms.minKmPerDay} km/day minimum)`
          : `${chargeableKm} km`,
    })
  }

  const bata = round(terms.driverBataPerDayPaise * days)
  if (bata > 0) {
    lines.push({ label: "Driver bata", amountPaise: bata, detail: `${days} day(s)` })
    fare += bata
  }

  const halt = round(terms.nightHaltPaise * nights)
  if (halt > 0) {
    lines.push({ label: "Night halt", amountPaise: halt, detail: `${nights} night(s)` })
    fare += halt
  }

  // Tax is computed on the fare and added, so the estimated total is the
  // all-inclusive number a customer compares. The treatment travels with the
  // quote (§8.3) rather than being assumed here.
  const gst = computeGst(fare, terms.gstTreatment, true)

  const worstCaseItems = worstCase(terms, shape, {
    days,
    chargeableKm,
    perKmRatePaise: terms.perKmRatePaise ?? terms.extraKmRatePaise ?? 0,
  })

  const worstCaseExtra = worstCaseItems.reduce((total, item) => total + item.amountPaise, 0)

  return {
    chargeableKm,
    minimumKmShortfall,
    fareBeforeTaxPaise: fare,
    taxPaise: gst.taxPaise,
    estimatedTotalPaise: gst.totalPaise,
    worstCaseTotalPaise: gst.totalPaise + worstCaseExtra,
    worstCaseItems,
    lines,
  }
}

function worstCase(
  terms: QuoteTerms,
  shape: TripShape,
  context: { days: number; chargeableKm: number; perKmRatePaise: number },
): WorstCaseItem[] {
  const items: WorstCaseItem[] = []

  if (!terms.tollIncluded) {
    items.push({
      label: "Tolls",
      amountPaise: round((context.chargeableKm / 100) * WORST_CASE_ALLOWANCES.tollPer100KmPaise),
      reason: "excluded from this quote — payable by you en route",
    })
  }

  if (!terms.parkingIncluded) {
    items.push({
      label: "Parking",
      amountPaise: WORST_CASE_ALLOWANCES.parkingPerDayPaise * context.days,
      reason: "excluded from this quote",
    })
  }

  // The classic ₹28,000-becomes-₹41,000 charge. Interstate composite tax is
  // levied per state entered and is genuinely thousands of rupees each.
  if (shape.interstate && !terms.statePermitIncluded) {
    const states = Math.max(1, shape.stateCount)
    items.push({
      label: "Interstate permit tax",
      amountPaise: WORST_CASE_ALLOWANCES.statePermitPerStatePaise * states,
      reason: `excluded — ${states} state border(s) on this route`,
    })
  }

  if (!terms.fuelIncluded) {
    items.push({
      label: "Fuel",
      amountPaise: 0,
      reason: "excluded — rare, and worth questioning before you book",
    })
  }

  const overrunKm = Math.round(context.chargeableKm * WORST_CASE_ALLOWANCES.distanceOverrunFactor)
  if (overrunKm > 0 && context.perKmRatePaise > 0) {
    items.push({
      label: "Distance overrun",
      amountPaise: round(overrunKm * context.perKmRatePaise),
      reason: `if the route runs ${overrunKm} km longer than estimated`,
    })
  }

  return items
}

/**
 * The standardised inclusion/exclusion chips from §4.1.
 *
 * The same six facts, in the same order, on every quote card. That sameness is
 * the point — a customer scanning five quotes should be comparing amounts, not
 * re-reading five different people's prose about tolls.
 */
export type QuoteChip = { label: string; tone: "included" | "excluded" | "info" }

export function quoteChips(terms: QuoteTerms, shape: TripShape): QuoteChip[] {
  const chips: QuoteChip[] = [
    {
      label: terms.tollIncluded ? "Toll included" : "Toll excluded",
      tone: terms.tollIncluded ? "included" : "excluded",
    },
    {
      label: terms.parkingIncluded ? "Parking included" : "Parking excluded",
      tone: terms.parkingIncluded ? "included" : "excluded",
    },
  ]

  if (shape.interstate) {
    chips.push({
      label: terms.statePermitIncluded ? "Interstate tax included" : "Interstate tax excluded",
      tone: terms.statePermitIncluded ? "included" : "excluded",
    })
  }

  chips.push({
    label: `Driver bata ${formatPaise(terms.driverBataPerDayPaise)}/day`,
    tone: "info",
  })

  if (shape.nights > 0) {
    chips.push({ label: `Night halt ${formatPaise(terms.nightHaltPaise)}`, tone: "info" })
  }

  if (terms.minKmPerDay) {
    chips.push({ label: `Min ${terms.minKmPerDay} km/day`, tone: "info" })
  }

  if (!terms.fuelIncluded) {
    chips.push({ label: "Fuel excluded", tone: "excluded" })
  }

  return chips
}

/**
 * Refuses a quote that cannot be compared.
 *
 * An operator leaving `minKmPerDay` blank on an outstation trip is not being
 * sloppy — that blank is where the extra ₹13,000 hides. The plan makes these
 * fields mandatory and visible; this is where "mandatory" is enforced.
 */
export function validateQuoteTerms(terms: QuoteTerms, shape: TripShape): string[] {
  const problems: string[] = []
  const basis = pricingBasis(shape.tripType)

  if (basis === "distance") {
    if (!terms.perKmRatePaise || terms.perKmRatePaise <= 0) {
      problems.push("Per-km rate is required for an outstation trip.")
    }
    if (!terms.minKmPerDay || terms.minKmPerDay <= 0) {
      problems.push(
        "Minimum km per day is required — it is the charge customers are most often surprised by.",
      )
    }
  } else {
    if (terms.baseFarePaise <= 0) {
      problems.push("Base fare is required for a package trip.")
    }
    if (!terms.includedKm || !terms.includedHours) {
      problems.push("A package quote must say how many km and hours the base fare covers.")
    }
    if (!terms.extraKmRatePaise || !terms.extraHourRatePaise) {
      problems.push("Extra km and extra hour rates are required, so overage is priced up front.")
    }
  }

  if (shape.nights > 0 && terms.nightHaltPaise <= 0) {
    problems.push("This trip has overnight halts; state the night halt charge, even if it is nil.")
  }

  return problems
}
