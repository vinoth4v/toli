import { describe, expect, it } from "vitest"
import { daysUntil, departureLabel, formatDay, formatRange } from "./dates.ts"

describe("formatDay", () => {
  it("writes a calendar date the way it is read aloud", () => {
    const formatted = formatDay("2026-08-03")

    expect(formatted).toContain("3")
    expect(formatted).toContain("Aug")
    expect(formatted).toContain("2026")
  })

  it("hands back anything it cannot parse rather than showing NaN", () => {
    expect(formatDay("soon")).toBe("soon")
  })
})

describe("formatRange", () => {
  it("collapses a same-day trip to one date", () => {
    expect(formatRange("2026-08-03", "2026-08-03")).toBe(formatDay("2026-08-03"))
  })

  it("shows both ends of a multi-day trip", () => {
    expect(formatRange("2026-08-03", "2026-08-05")).toContain("–")
  })
})

describe("daysUntil", () => {
  const now = new Date("2026-08-10T18:30:00Z")

  it("counts calendar days, not 24-hour periods", () => {
    // Late evening UTC, so a naive difference would round this to two days.
    expect(daysUntil("2026-08-13", now)).toBe(3)
  })

  it("is zero on the day itself", () => {
    expect(daysUntil("2026-08-10", now)).toBe(0)
  })

  it("goes negative for a departure that has passed", () => {
    expect(daysUntil("2026-08-08", now)).toBe(-2)
  })
})

describe("departureLabel", () => {
  const now = new Date("2026-08-10T06:00:00Z")

  it("says the useful thing for the near dates", () => {
    expect(departureLabel("2026-08-10", now)).toBe("Today")
    expect(departureLabel("2026-08-11", now)).toBe("Tomorrow")
    expect(departureLabel("2026-08-20", now)).toBe("In 10 days")
    expect(departureLabel("2026-08-09", now)).toBe("1 day ago")
  })
})
