import { describe, expect, it } from "vitest"
import { applyBps, formatInr, parseRupees } from "./money.ts"

describe("parseRupees", () => {
  it("reads what a dispatcher actually types", () => {
    expect(parseRupees("32000")).toBe(3_200_000)
    expect(parseRupees("32,000")).toBe(3_200_000)
    expect(parseRupees(" ₹32,000 ")).toBe(3_200_000)
    expect(parseRupees("32000.50")).toBe(3_200_050)
  })

  it("accepts zero, which is a real answer for an included extra", () => {
    expect(parseRupees("0")).toBe(0)
  })

  it("refuses anything that is not a non-negative amount", () => {
    expect(parseRupees("")).toBeNull()
    expect(parseRupees("   ")).toBeNull()
    expect(parseRupees("about 32k")).toBeNull()
    expect(parseRupees("-500")).toBeNull()
    expect(parseRupees("1.234")).toBeNull()
    expect(parseRupees(undefined)).toBeNull()
    expect(parseRupees(Number.NaN)).toBeNull()
  })

  it("takes a number as readily as a string", () => {
    expect(parseRupees(1200.5)).toBe(120_050)
  })
})

describe("formatInr", () => {
  it("groups in lakhs, not thousands", () => {
    expect(formatInr(12_345_600)).toBe("₹1,23,456")
  })

  it("hides paise unless asked", () => {
    expect(formatInr(3_200_050)).toBe("₹32,001")
    expect(formatInr(3_200_050, { paisa: true })).toBe("₹32,000.50")
  })
})

describe("applyBps", () => {
  it("takes a percentage in basis points", () => {
    expect(applyBps(4_430_000, 1000)).toBe(443_000)
    expect(applyBps(4_430_000, 2000)).toBe(886_000)
    expect(applyBps(4_430_000, 0)).toBe(0)
  })

  it("rounds to a whole paisa", () => {
    expect(applyBps(1001, 3333)).toBe(334)
  })
})
