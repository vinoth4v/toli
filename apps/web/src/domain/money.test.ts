import { describe, expect, it } from "vitest"
import { applyBps, formatBps, formatPaise, parseRupeesToPaise, sumPaise } from "./money.ts"

describe("formatPaise", () => {
  it("groups digits the Indian way", () => {
    // 28,400 not 28,400 — the difference shows at six digits.
    expect(formatPaise(2_840_000)).toBe("₹28,400")
    expect(formatPaise(1_00_00_000_00)).toBe("₹1,00,00,000")
  })

  it("shows paise only when there are any", () => {
    expect(formatPaise(2_840_050)).toBe("₹28,400.50")
    expect(formatPaise(0)).toBe("₹0")
  })

  it("marks a negative amount", () => {
    expect(formatPaise(-50_000)).toContain("500")
    expect(formatPaise(-50_000).startsWith("−")).toBe(true)
  })
})

describe("parseRupeesToPaise", () => {
  it("accepts what people actually type", () => {
    expect(parseRupeesToPaise("28400")).toBe(2_840_000)
    expect(parseRupeesToPaise("28,400")).toBe(2_840_000)
    expect(parseRupeesToPaise("₹28,400")).toBe(2_840_000)
    expect(parseRupeesToPaise(" 28400.5 ")).toBe(2_840_050)
    expect(parseRupeesToPaise("28400.05")).toBe(2_840_005)
  })

  it("treats an empty optional charge as zero", () => {
    expect(parseRupeesToPaise("")).toBe(0)
    expect(parseRupeesToPaise(null)).toBe(0)
    expect(parseRupeesToPaise(undefined)).toBe(0)
  })

  it("refuses sub-paisa precision rather than silently truncating it", () => {
    // A per-km rate quietly rounded is 0.4% wrong across ten thousand km.
    expect(() => parseRupeesToPaise("22.456")).toThrow()
    expect(() => parseRupeesToPaise("twenty")).toThrow()
  })

  it("round-trips through paise without drift", () => {
    const total = sumPaise([
      parseRupeesToPaise("22.50"),
      parseRupeesToPaise("22.50"),
      parseRupeesToPaise("22.50"),
      parseRupeesToPaise("22.50"),
    ])
    expect(total).toBe(9_000)
  })
})

describe("applyBps", () => {
  it("takes a basis-point share, rounded to the paisa", () => {
    expect(applyBps(2_840_000, 1000)).toBe(284_000)
    expect(applyBps(2_840_000, 100)).toBe(28_400)
  })

  it("rounds rather than truncating, so deductions do not drift low", () => {
    expect(applyBps(333, 100)).toBe(3)
    expect(applyBps(1, 5000)).toBe(1)
  })

  it("formats a rate the way an operator agreement states it", () => {
    expect(formatBps(1000)).toBe("10%")
    expect(formatBps(850)).toBe("8.50%")
  })
})
