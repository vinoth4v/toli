import { describe, expect, it } from "vitest"
import { percentile, priceBand, routeBand, verdict } from "./fairprice.ts"
import { formatRate, leakageSuspect, marketplaceHealth, operationalTrust } from "./metrics.ts"
import { tripDuration } from "./trip.ts"
import { canTransition, suggestConfigurations } from "./vehicle.ts"

describe("fair price band", () => {
  it("says nothing until there are enough comparable quotes", () => {
    // A band drawn from three quotes is an anecdote with a decimal point.
    expect(priceBand([100, 200, 300, 400])).toBeNull()
    expect(priceBand([100, 200, 300, 400, 500])).not.toBeNull()
  })

  it("interpolates, so one new quote does not move the band by a whole quote", () => {
    expect(percentile([10, 20, 30, 40], 0.25)).toBe(18)
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25)
    expect(percentile([10, 20, 30, 40], 0.75)).toBe(33)
  })

  it("places a quote against the band", () => {
    const band = priceBand([2_400_000, 2_600_000, 2_800_000, 3_000_000, 3_100_000])
    if (!band) throw new Error("band expected")

    expect(verdict(2_000_000, band)).toBe("below")
    expect(verdict(2_800_000, band)).toBe("within")
    expect(verdict(3_500_000, band)).toBe("above")
  })

  it("buckets distance the way the market talks about trips", () => {
    expect(routeBand(80)).toBe("local")
    expect(routeBand(280)).toBe("day")
    expect(routeBand(620)).toBe("overnight")
    expect(routeBand(1_400)).toBe("long")
  })
})

describe("marketplace health", () => {
  const created = new Date("2026-08-10T04:00:00Z")
  const minutesLater = (minutes: number) => new Date(created.getTime() + minutes * 60_000)

  it("counts a request as answered only at three quotes inside thirty minutes", () => {
    const health = marketplaceHealth([
      {
        createdAt: created,
        quotedAt: [minutesLater(5), minutesLater(12), minutesLater(20)],
        booked: true,
      },
      {
        createdAt: created,
        quotedAt: [minutesLater(5), minutesLater(12), minutesLater(45)],
        booked: false,
      },
      { createdAt: created, quotedAt: [], booked: false },
    ])

    expect(health.responseRate).toBeCloseTo(1 / 3)
    expect(health.conversionRate).toBeCloseTo(1 / 3)
    expect(health.unquoted).toBe(1)
  })

  it("reports the median time to the first quote, ignoring requests with none", () => {
    const health = marketplaceHealth([
      { createdAt: created, quotedAt: [minutesLater(4), minutesLater(30)], booked: false },
      { createdAt: created, quotedAt: [minutesLater(10)], booked: false },
      { createdAt: created, quotedAt: [minutesLater(22)], booked: false },
      { createdAt: created, quotedAt: [], booked: false },
    ])

    expect(health.medianMinutesToFirstQuote).toBe(10)
  })

  it("survives an empty week without dividing by zero", () => {
    expect(marketplaceHealth([]).responseRate).toBe(0)
    expect(formatRate(null)).toBe("—")
  })
})

describe("operational trust", () => {
  const scheduled = new Date("2026-08-10T00:30:00Z")

  it("counts a start within fifteen minutes as on time", () => {
    const trust = operationalTrust([
      {
        scheduledStartAt: scheduled,
        actualStartAt: new Date("2026-08-10T00:40:00Z"),
        cancelledByOperator: false,
        matchedBooking: true,
      },
      {
        scheduledStartAt: scheduled,
        actualStartAt: new Date("2026-08-10T01:30:00Z"),
        cancelledByOperator: false,
        matchedBooking: false,
      },
    ])

    expect(trust.onTimeRate).toBe(0.5)
    expect(trust.matchRate).toBe(0.5)
  })

  it("has no opinion on on-time performance before any trip has run", () => {
    const trust = operationalTrust([
      {
        scheduledStartAt: scheduled,
        actualStartAt: null,
        cancelledByOperator: true,
        matchedBooking: false,
      },
    ])

    expect(trust.onTimeRate).toBeNull()
    expect(trust.operatorCancellationRate).toBe(1)
  })
})

describe("leakage proxy", () => {
  it("stays quiet until an operator has quoted enough to judge", () => {
    expect(leakageSuspect({ quotes: 4, bookings: 0 })).toBe(false)
  })

  it("flags an operator who quotes constantly and never converts", () => {
    expect(leakageSuspect({ quotes: 40, bookings: 1 })).toBe(true)
    expect(leakageSuspect({ quotes: 40, bookings: 8 })).toBe(false)
  })
})

describe("vehicle suggestions", () => {
  it("offers real configurations for a group, fewest vehicles first", () => {
    const suggestions = suggestConfigurations(34)

    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]?.count).toBe(1)
    for (const suggestion of suggestions) {
      expect(suggestion.seats * suggestion.count).toBeGreaterThanOrEqual(34)
    }
  })

  it("does not propose a convoy", () => {
    expect(suggestConfigurations(12).every((suggestion) => suggestion.count <= 3)).toBe(true)
  })

  it("has nothing to say about a group of nobody", () => {
    expect(suggestConfigurations(0)).toEqual([])
  })
})

describe("vehicle lifecycle", () => {
  it("will not let a suspended vehicle go straight back to active", () => {
    // Otherwise an expired-insurance suspension means nothing.
    expect(canTransition("suspended", "active")).toBe(false)
    expect(canTransition("suspended", "pending_verification")).toBe(true)
  })

  it("is the end of the line once a vehicle is retired", () => {
    expect(canTransition("retired", "active")).toBe(false)
    expect(canTransition("retired", "draft")).toBe(false)
  })
})

describe("trip duration", () => {
  it("counts a same-day trip as one day and no nights", () => {
    expect(
      tripDuration(new Date("2026-08-10T01:00:00Z"), new Date("2026-08-10T14:00:00Z")),
    ).toEqual({ days: 1, nights: 0 })
  })

  it("counts midnights in IST, not UTC", () => {
    // 11 PM IST on the 10th is already the 11th in UTC. Counting UTC midnights
    // would bill a night halt nobody spent away.
    expect(
      tripDuration(new Date("2026-08-10T01:00:00Z"), new Date("2026-08-10T17:30:00Z")),
    ).toEqual({ days: 1, nights: 0 })
  })

  it("adds a day and a night for each midnight crossed", () => {
    expect(
      tripDuration(new Date("2026-08-10T01:00:00Z"), new Date("2026-08-12T10:00:00Z")),
    ).toEqual({ days: 3, nights: 2 })
  })
})
