import { describe, expect, it } from "vitest"
import {
  DEFAULT_ADVANCE_BPS,
  priceQuote,
  type QuoteTerms,
  rankQuotes,
  settlement,
  splitAdvance,
  type TripShape,
  tripDuration,
} from "./pricing.ts"

const trip: TripShape = { days: 3, nights: 2, estimatedKm: 1200, passengers: 24 }

/** A 3-day Jaipur wedding run, quoted the way a fleet office actually quotes. */
function terms(overrides: Partial<QuoteTerms> = {}): QuoteTerms {
  return {
    baseFarePaise: 3_200_000, // ₹32,000
    includedKm: 1000,
    perKmPaise: 1800, // ₹18/km
    driverBataPaise: 60_000, // ₹600/day
    nightHaltPaise: 50_000, // ₹500/night
    tollsIncluded: false,
    tollsPaise: 250_000,
    parkingIncluded: false,
    parkingPaise: 40_000,
    permitIncluded: false,
    permitPaise: 300_000,
    ...overrides,
  }
}

describe("tripDuration", () => {
  it("counts both ends of the trip", () => {
    expect(tripDuration("2026-08-03", "2026-08-05")).toEqual({ days: 3, nights: 2 })
  })

  it("treats a same-day trip as one day and no night halt", () => {
    expect(tripDuration("2026-08-03", "2026-08-03")).toEqual({ days: 1, nights: 0 })
  })

  it("never returns a negative duration when the dates are the wrong way round", () => {
    expect(tripDuration("2026-08-05", "2026-08-03")).toEqual({ days: 1, nights: 0 })
  })

  it("crosses a DST-shaped month boundary without losing a day", () => {
    expect(tripDuration("2026-10-30", "2026-11-02").days).toBe(4)
  })

  it("falls back to a single day rather than NaN on unparseable dates", () => {
    expect(tripDuration("not-a-date", "2026-08-05")).toEqual({ days: 1, nights: 0 })
  })
})

describe("priceQuote", () => {
  it("adds up every component of the landed cost", () => {
    const priced = priceQuote(trip, terms())

    // 32,000 base + 200km × 18 + 3 × 600 + 2 × 500 + 2,500 toll + 400 parking + 3,000 permit
    expect(priced.allInPaise).toBe(4_430_000)
    expect(priced.extraKm).toBe(200)
  })

  it("charges nothing for kilometres inside the allowance", () => {
    const priced = priceQuote(trip, terms({ includedKm: 2000 }))

    expect(priced.extraKm).toBe(0)
    expect(priced.lines.find((line) => line.label === "Extra kilometres")?.amountPaise).toBe(0)
  })

  it("zeroes an included extra but still reports the line", () => {
    const priced = priceQuote(trip, terms({ tollsIncluded: true }))
    const tolls = priced.lines.find((line) => line.label === "Tolls")

    expect(tolls?.amountPaise).toBe(0)
    expect(tolls?.note).toBe("Included in the fare")
    // The toll estimate is kept on the quote, so it must not leak into the total.
    expect(priced.allInPaise).toBe(4_180_000)
  })

  it("skips the night halt entirely on a same-day trip", () => {
    const priced = priceQuote({ ...trip, days: 1, nights: 0 }, terms())

    expect(priced.lines.find((line) => line.label === "Night halt")?.amountPaise).toBe(0)
    expect(priced.lines.find((line) => line.label === "Driver bata")?.amountPaise).toBe(60_000)
  })

  it("divides by passengers without dividing by zero", () => {
    const priced = priceQuote({ ...trip, passengers: 0 }, terms())

    expect(priced.perPassengerPaise).toBe(priced.allInPaise)
  })

  it("reports per-passenger and per-day figures the desk can quote back", () => {
    const priced = priceQuote(trip, terms())

    expect(priced.perPassengerPaise).toBe(Math.round(4_430_000 / 24))
    expect(priced.perDayPaise).toBe(Math.round(4_430_000 / 3))
  })
})

describe("rankQuotes", () => {
  it("puts the lower landed cost first even when its headline fare is higher", () => {
    // The cheap-looking quote: ₹28,000, but only 800km included and every
    // extra charged on top. This is the whole point of Fair Price.
    const looksCheap = terms({
      baseFarePaise: 2_800_000,
      includedKm: 800,
      perKmPaise: 2200,
      permitPaise: 500_000,
    })
    const looksDear = terms({
      baseFarePaise: 3_600_000,
      includedKm: 1400,
      tollsIncluded: true,
      parkingIncluded: true,
      permitIncluded: true,
    })

    const ranked = rankQuotes(trip, [looksCheap, looksDear])

    expect(ranked[0]?.quote).toBe(looksDear)
    expect(ranked[0]?.rank).toBe(1)
    expect(ranked[0]?.deltaPaise).toBe(0)
    expect(ranked[1]?.deltaPaise).toBeGreaterThan(0)
  })

  it("returns nothing for no quotes rather than a phantom cheapest", () => {
    expect(rankQuotes(trip, [])).toEqual([])
  })

  it("keeps the input order for two identical quotes", () => {
    const first = terms()
    const second = terms()
    const ranked = rankQuotes(trip, [first, second])

    expect(ranked[0]?.quote).toBe(first)
    expect(ranked[1]?.deltaPaise).toBe(0)
  })
})

describe("splitAdvance", () => {
  it("takes a quarter up front by default and leaves the rest", () => {
    const { advancePaise, balancePaise } = splitAdvance(4_430_000)

    expect(advancePaise).toBe(1_107_500)
    expect(advancePaise + balancePaise).toBe(4_430_000)
    expect(DEFAULT_ADVANCE_BPS).toBe(2500)
  })

  it("never loses a paisa to rounding", () => {
    const { advancePaise, balancePaise } = splitAdvance(1001, 3333)

    expect(advancePaise + balancePaise).toBe(1001)
  })
})

describe("settlement", () => {
  it("splits the fare into Toli's cut and the operator's payout", () => {
    const { commissionPaise, operatorPayoutPaise } = settlement(4_430_000, 1000)

    expect(commissionPaise).toBe(443_000)
    expect(commissionPaise + operatorPayoutPaise).toBe(4_430_000)
  })

  it("shows what an agent would have taken on the same trip", () => {
    const { commissionPaise, agentWouldHaveTakenPaise } = settlement(4_430_000, 1000)

    expect(agentWouldHaveTakenPaise).toBe(886_000)
    expect(agentWouldHaveTakenPaise).toBeGreaterThan(commissionPaise)
  })
})
