import { describe, expect, test } from "vitest"
import { formatRef, newRef, randomSuffix } from "@/domain/reference"

describe("formatRef", () => {
  test("date-prefixes the code so it sorts and ages visibly", () => {
    expect(formatRef("TL", new Date("2026-08-10T09:00:00.000Z"), "K4P2")).toBe("TL-260810-K4P2")
    expect(formatRef("BK", new Date("2027-01-05T00:00:00.000Z"), "9WXZ")).toBe("BK-270105-9WXZ")
  })

  test("uses UTC, so the same instant never yields two different codes", () => {
    // Late evening IST is still the same UTC day the server would stamp.
    expect(formatRef("TL", new Date("2026-08-10T20:30:00.000Z"), "AAAA")).toBe("TL-260810-AAAA")
  })
})

describe("randomSuffix", () => {
  test("avoids the characters that get misheard over a phone", () => {
    const suffix = randomSuffix(64)

    expect(suffix).toHaveLength(64)
    expect(suffix).not.toMatch(/[AEIOU01]/)
    expect(suffix).toMatch(/^[2-9CFGHJKLMNPQRSTVWXZ]+$/)
  })
})

describe("newRef", () => {
  test("is unique enough that two enquiries in one minute cannot collide", () => {
    const at = new Date("2026-08-10T09:00:00.000Z")
    const refs = new Set(Array.from({ length: 200 }, () => newRef("TL", at)))

    expect(refs.size).toBeGreaterThan(190)
    for (const ref of refs) expect(ref).toMatch(/^TL-260810-[2-9CFGHJKLMNPQRSTVWXZ]{4}$/)
  })
})
