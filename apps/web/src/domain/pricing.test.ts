import { describe, expect, test } from "vitest"
import { PAISE } from "@/domain/money"
import {
  advanceDuePaise,
  computeQuote,
  DEFAULT_COMMISSION_BPS,
  hasDailyMinimum,
  quoteLines,
} from "@/domain/pricing"
import { RATE_CARDS } from "@/domain/vehicles"

const base = {
  vehicleClass: "tempo_traveller",
  tripType: "round_trip",
  estimatedKm: 600,
  days: 2,
} as const

describe("computeQuote", () => {
  test("bills the distance actually driven when it clears the daily floor", () => {
    const card = RATE_CARDS.tempo_traveller
    const quote = computeQuote(base)

    expect(quote.chargeableKm).toBe(600)
    expect(quote.minimumKmApplied).toBe(false)
    expect(quote.baseFarePaise).toBe(600 * card.perKmPaise)
    expect(quote.driverAllowancePaise).toBe(2 * card.driverAllowancePerDayPaise)
    // Two days away is one night, not two.
    expect(quote.nights).toBe(1)
    expect(quote.nightHaltPaise).toBe(card.nightHaltPaise)
  })

  test("raises a short round trip to the daily kilometre floor", () => {
    const quote = computeQuote({ ...base, estimatedKm: 120 })

    expect(quote.chargeableKm).toBe(RATE_CARDS.tempo_traveller.minimumKmPerDay * 2)
    expect(quote.minimumKmApplied).toBe(true)
  })

  test("charges a one-way drop for its real distance and no night halt", () => {
    const quote = computeQuote({ ...base, tripType: "one_way", estimatedKm: 80, days: 1 })

    expect(hasDailyMinimum("one_way")).toBe(false)
    expect(quote.chargeableKm).toBe(80)
    expect(quote.minimumKmApplied).toBe(false)
    expect(quote.nights).toBe(0)
    expect(quote.nightHaltPaise).toBe(0)
  })

  test("prefers the operator's own per-km rate over the class default", () => {
    const quote = computeQuote({ ...base, perKmPaiseOverride: 26 * PAISE })

    expect(quote.perKmPaise).toBe(26 * PAISE)
    expect(quote.baseFarePaise).toBe(600 * 26 * PAISE)
  })

  test("ignores a zero or negative override rather than quoting a free trip", () => {
    expect(computeQuote({ ...base, perKmPaiseOverride: 0 }).perKmPaise).toBe(
      RATE_CARDS.tempo_traveller.perKmPaise,
    )
    expect(computeQuote({ ...base, perKmPaiseOverride: -500 }).perKmPaise).toBe(
      RATE_CARDS.tempo_traveller.perKmPaise,
    )
  })

  test("adds GST on top of the fare and leaves the total exact in paise", () => {
    const quote = computeQuote({ ...base, gstRateBps: 500 })

    expect(quote.gstPaise).toBe(Math.round(quote.subtotalPaise * 0.05))
    expect(quote.totalPaise).toBe(quote.subtotalPaise + quote.gstPaise)
    expect(Number.isInteger(quote.totalPaise)).toBe(true)
  })

  test("charges the 12% regime when that is the one chosen", () => {
    const five = computeQuote({ ...base, gstRateBps: 500 })
    const twelve = computeQuote({ ...base, gstRateBps: 1200 })

    expect(twelve.subtotalPaise).toBe(five.subtotalPaise)
    expect(twelve.gstPaise).toBeGreaterThan(five.gstPaise)
    expect(twelve.gstPaise).toBe(Math.round(twelve.subtotalPaise * 0.12))
  })

  test("takes commission on the fare, not on the tax collected for the operator", () => {
    const quote = computeQuote({ ...base, gstRateBps: 1200 })

    expect(quote.commissionBps).toBe(DEFAULT_COMMISSION_BPS)
    expect(quote.commissionPaise).toBe(
      Math.round((quote.subtotalPaise * DEFAULT_COMMISSION_BPS) / 10_000),
    )
    // The giveaway if this ever regresses: commission scaling with the GST rate.
    expect(quote.commissionPaise).toBe(computeQuote({ ...base, gstRateBps: 500 }).commissionPaise)
  })

  test("splits the fare exactly between commission and payout", () => {
    const quote = computeQuote({ ...base, tollsParkingPaise: 2_345 })

    expect(quote.commissionPaise + quote.operatorPayoutPaise).toBe(quote.subtotalPaise)
  })

  test("passes tolls and parking through at cost", () => {
    const without = computeQuote(base)
    const with_ = computeQuote({ ...base, tollsParkingPaise: 150_000 })

    expect(with_.subtotalPaise - without.subtotalPaise).toBe(150_000)
  })

  test("never bills a fraction of a day or a negative distance", () => {
    const quote = computeQuote({ ...base, days: 0, estimatedKm: -40 })

    expect(quote.driverAllowancePaise).toBe(RATE_CARDS.tempo_traveller.driverAllowancePerDayPaise)
    expect(quote.chargeableKm).toBe(RATE_CARDS.tempo_traveller.minimumKmPerDay)
  })

  test("costs more for a bigger vehicle over the same route", () => {
    const traveller = computeQuote(base)
    const coach = computeQuote({ ...base, vehicleClass: "coach" })

    expect(coach.totalPaise).toBeGreaterThan(traveller.totalPaise)
  })
})

describe("advanceDuePaise", () => {
  test("asks for a quarter of the fare, rounded up to a readable ₹100", () => {
    expect(advanceDuePaise(1_000_000)).toBe(250_000)
    expect(advanceDuePaise(1_857_300)).toBe(470_000)
  })

  test("never exceeds the fare itself", () => {
    for (const total of [100, 5_000, 123_456, 9_999_999]) {
      expect(advanceDuePaise(total)).toBeLessThanOrEqual(total)
    }
  })
})

describe("quoteLines", () => {
  test("lists only the charges that apply", () => {
    const drop = quoteLines(computeQuote({ ...base, tripType: "one_way", days: 1 }))
    expect(drop.map((line) => line.label)).toEqual([
      expect.stringContaining("km ×"),
      "Driver allowance",
    ])

    const tour = quoteLines(computeQuote({ ...base, tollsParkingPaise: 90_000 }))
    expect(tour.map((line) => line.label)).toContain("Night halt × 1")
    expect(tour.map((line) => line.label)).toContain("Tolls, permits and parking")
  })

  test("adds up to the fare before tax", () => {
    const quote = computeQuote({ ...base, tollsParkingPaise: 90_000 })
    const sum = quoteLines(quote).reduce((total, line) => total + line.paise, 0)

    expect(sum).toBe(quote.subtotalPaise)
  })
})
