import { describe, expect, test } from "vitest"
import { daysUntil, parseIstLocal, relativeDays, toIstLocalInput } from "@/domain/datetime"

describe("parseIstLocal", () => {
  test("reads a datetime-local value as IST, not as server time", () => {
    const parsed = parseIstLocal("2026-08-15T06:30")

    // 06:30 IST is 01:00 UTC the same morning.
    expect(parsed?.toISOString()).toBe("2026-08-15T01:00:00.000Z")
  })

  test("refuses anything that is not a datetime-local value", () => {
    expect(parseIstLocal("")).toBeNull()
    expect(parseIstLocal("15/08/2026")).toBeNull()
    expect(parseIstLocal("2026-08-15")).toBeNull()
    expect(parseIstLocal("2026-13-40T99:99")).toBeNull()
  })
})

describe("toIstLocalInput", () => {
  test("round-trips a parsed value", () => {
    const value = "2026-08-15T06:30"
    const parsed = parseIstLocal(value)

    expect(parsed && toIstLocalInput(parsed)).toBe(value)
  })

  test("shows an instant in IST, not UTC", () => {
    // 20:00 UTC is half past one the next morning in India.
    expect(toIstLocalInput(new Date("2026-08-15T20:00:00.000Z"))).toBe("2026-08-16T01:30")
  })
})

describe("daysUntil", () => {
  test("counts whole days forward and back", () => {
    const now = new Date("2026-08-10T09:00:00.000Z")

    expect(daysUntil(new Date("2026-08-13T09:00:00.000Z"), now)).toBe(3)
    expect(daysUntil(new Date("2026-08-09T09:00:00.000Z"), now)).toBe(-1)
    expect(daysUntil(now, now)).toBe(0)
  })
})

describe("relativeDays", () => {
  test("says it the way a dispatcher would", () => {
    const now = new Date("2026-08-10T09:00:00.000Z")

    expect(relativeDays(new Date("2026-08-10T15:00:00.000Z"), now)).toBe("today")
    expect(relativeDays(new Date("2026-08-11T09:00:00.000Z"), now)).toBe("tomorrow")
    expect(relativeDays(new Date("2026-08-14T09:00:00.000Z"), now)).toBe("in 4 days")
    expect(relativeDays(new Date("2026-08-09T09:00:00.000Z"), now)).toBe("yesterday")
    expect(relativeDays(new Date("2026-08-05T09:00:00.000Z"), now)).toBe("5 days ago")
  })
})
