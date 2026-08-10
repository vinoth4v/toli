import { describe, expect, test } from "vitest"
import { applyBps, formatBps, formatInr, formatInrExact, rupeesToPaise } from "@/domain/money"

describe("applyBps", () => {
  test("applies a basis-point rate as an integer number of paise", () => {
    expect(applyBps(100_000, 500)).toBe(5_000)
    expect(applyBps(100_000, 1200)).toBe(12_000)
    expect(applyBps(0, 1200)).toBe(0)
  })

  test("rounds rather than truncating, so a split does not lose paise", () => {
    expect(applyBps(333, 500)).toBe(17)
    expect(Number.isInteger(applyBps(987_654, 1237))).toBe(true)
  })
})

describe("rupeesToPaise", () => {
  test("converts what a human typed without floating-point drift", () => {
    expect(rupeesToPaise(1234.56)).toBe(123_456)
    expect(rupeesToPaise(0.1)).toBe(10)
    expect(rupeesToPaise(1815.7)).toBe(181_570)
  })
})

describe("formatInr", () => {
  test("groups in the Indian system — lakhs and crores, not thousands", () => {
    expect(formatInr(1_854_000)).toBe("₹18,540")
    expect(formatInr(12_500_000)).toBe("₹1,25,000")
  })
})

describe("formatInrExact", () => {
  test("keeps both paise digits for a line that must reconcile", () => {
    expect(formatInrExact(123_456)).toBe("1,234.56")
    expect(formatInrExact(5)).toBe("0.05")
    expect(formatInrExact(-2_50)).toBe("-2.50")
  })
})

describe("formatBps", () => {
  test("reads back as the percentage a person would say", () => {
    expect(formatBps(1200)).toBe("12%")
    expect(formatBps(500)).toBe("5%")
    expect(formatBps(1250)).toBe("12.50%")
  })
})
