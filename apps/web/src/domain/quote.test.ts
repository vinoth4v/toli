import { describe, expect, it } from "vitest"
import {
  priceQuote,
  type QuoteTerms,
  quoteChips,
  type TripShape,
  validateQuoteTerms,
} from "./quote.ts"

const outstationTerms: QuoteTerms = {
  baseFarePaise: 0,
  includedKm: null,
  includedHours: null,
  extraKmRatePaise: null,
  extraHourRatePaise: null,
  perKmRatePaise: 2_200,
  minKmPerDay: 300,
  driverBataPerDayPaise: 50_000,
  nightHaltPaise: 30_000,
  tollIncluded: true,
  parkingIncluded: false,
  statePermitIncluded: false,
  fuelIncluded: true,
  gstTreatment: "passenger_transport_5",
}

/** Madurai up to Munnar and back — 480 km over two days, crossing into Kerala. */
const maduraiToMunnar: TripShape = {
  tripType: "round_trip",
  days: 2,
  nights: 1,
  estimatedKm: 480,
  estimatedHours: 20,
  interstate: true,
  stateCount: 1,
}

describe("outstation pricing", () => {
  it("charges the daily minimum when the trip runs short of it", () => {
    // 2 days x 300 km/day = 600 km charged for 480 km travelled. This is the
    // charge §7.1 says is most often hidden, so it must be arithmetic.
    const priced = priceQuote(outstationTerms, maduraiToMunnar)

    expect(priced.chargeableKm).toBe(600)
    expect(priced.minimumKmShortfall).toBe(120)
  })

  it("charges actual distance when it exceeds the minimum", () => {
    const priced = priceQuote(outstationTerms, { ...maduraiToMunnar, estimatedKm: 720 })

    expect(priced.chargeableKm).toBe(720)
    expect(priced.minimumKmShortfall).toBe(0)
  })

  it("adds bata per day and night halt per night", () => {
    const priced = priceQuote(outstationTerms, maduraiToMunnar)

    // 600 km x ₹22 = ₹13,200; bata ₹500 x 2 = ₹1,000; halt ₹300 x 1.
    expect(priced.fareBeforeTaxPaise).toBe(600 * 2_200 + 2 * 50_000 + 30_000)
  })

  it("adds GST on top, at the treatment the quote carries", () => {
    const priced = priceQuote(outstationTerms, maduraiToMunnar)

    expect(priced.taxPaise).toBe(Math.round(priced.fareBeforeTaxPaise * 0.05))
    expect(priced.estimatedTotalPaise).toBe(priced.fareBeforeTaxPaise + priced.taxPaise)
  })

  it("names every excluded charge in the worst case rather than hiding it in a number", () => {
    const priced = priceQuote(outstationTerms, maduraiToMunnar)
    const labels = priced.worstCaseItems.map((item) => item.label)

    expect(labels).toContain("Parking")
    expect(labels).toContain("Interstate permit tax")
    expect(labels).toContain("Distance overrun")
    // Tolls were included in this quote, so they are not a worst case.
    expect(labels).not.toContain("Tolls")
    expect(priced.worstCaseTotalPaise).toBeGreaterThan(priced.estimatedTotalPaise)
  })

  it("is the ₹28,000-becomes-₹41,000 gap, made visible before booking", () => {
    const priced = priceQuote(outstationTerms, maduraiToMunnar)
    const gap = priced.worstCaseTotalPaise - priced.estimatedTotalPaise

    // One state permit alone is ₹5,000; the point of the column is that this
    // gap is large and knowable, not that it is small.
    expect(gap).toBeGreaterThan(500_000)
  })

  it("does not invent a permit charge on a trip that stays in one state", () => {
    const priced = priceQuote(outstationTerms, {
      ...maduraiToMunnar,
      interstate: false,
      stateCount: 0,
    })

    expect(priced.worstCaseItems.map((item) => item.label)).not.toContain("Interstate permit tax")
  })
})

describe("package pricing", () => {
  const packageTerms: QuoteTerms = {
    ...outstationTerms,
    baseFarePaise: 300_000,
    includedKm: 80,
    includedHours: 8,
    extraKmRatePaise: 1_800,
    extraHourRatePaise: 20_000,
    perKmRatePaise: null,
    minKmPerDay: null,
    nightHaltPaise: 0,
  }

  const localDay: TripShape = {
    tripType: "local_package_8_80",
    days: 1,
    nights: 0,
    estimatedKm: 110,
    estimatedHours: 10,
    interstate: false,
    stateCount: 0,
  }

  it("bills the base fare plus overage on both axes", () => {
    const priced = priceQuote(packageTerms, localDay)

    // ₹3,000 base + 30 km x ₹18 + 2 hr x ₹200 + ₹500 bata.
    expect(priced.fareBeforeTaxPaise).toBe(300_000 + 30 * 1_800 + 2 * 20_000 + 50_000)
  })

  it("charges no overage when the trip fits inside the package", () => {
    const priced = priceQuote(packageTerms, { ...localDay, estimatedKm: 60, estimatedHours: 6 })

    expect(priced.fareBeforeTaxPaise).toBe(300_000 + 50_000)
    expect(priced.lines.some((line) => line.label === "Extra kilometres")).toBe(false)
  })
})

describe("validation", () => {
  it("refuses an outstation quote with no minimum-km-per-day", () => {
    const problems = validateQuoteTerms({ ...outstationTerms, minKmPerDay: null }, maduraiToMunnar)

    expect(problems.join(" ")).toContain("Minimum km per day")
  })

  it("refuses a package quote that does not say what the base fare covers", () => {
    const problems = validateQuoteTerms(
      { ...outstationTerms, baseFarePaise: 100_000, includedKm: null, includedHours: null },
      { ...maduraiToMunnar, tripType: "local_package_8_80" },
    )

    expect(problems.join(" ")).toContain("how many km and hours")
  })

  it("accepts a complete outstation quote", () => {
    expect(validateQuoteTerms(outstationTerms, maduraiToMunnar)).toEqual([])
  })
})

describe("comparison chips", () => {
  it("states the same facts in the same order on every quote", () => {
    const chips = quoteChips(outstationTerms, maduraiToMunnar).map((chip) => chip.label)

    expect(chips[0]).toBe("Toll included")
    expect(chips[1]).toBe("Parking excluded")
    expect(chips[2]).toBe("Interstate tax excluded")
    expect(chips.some((chip) => chip.startsWith("Min 300 km/day"))).toBe(true)
  })

  it("omits the interstate chip on a trip that never leaves the state", () => {
    const chips = quoteChips(outstationTerms, { ...maduraiToMunnar, interstate: false })

    expect(chips.some((chip) => chip.label.includes("Interstate"))).toBe(false)
  })
})
