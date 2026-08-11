import { describe, expect, it } from "vitest"
import { rankOf, SEGMENT_INFO, SEGMENTS, satisfies, segmentFor } from "./segment.ts"

describe("segmentFor", () => {
  it("puts a non-AC vehicle in economy however it is fitted out", () => {
    // The claim this stops: a "luxury" non-AC bus.
    expect(segmentFor({ ac: false, features: ["pushback", "led_tv"] })).toBe("economy")
  })

  it("puts an AC vehicle in premium, and an AC push-back one in luxury", () => {
    expect(segmentFor({ ac: true, features: [] })).toBe("premium")
    expect(segmentFor({ ac: true, features: ["pushback"] })).toBe("luxury")
  })
})

describe("satisfies", () => {
  it("lets a better vehicle serve a cheaper booking, but never the reverse", () => {
    const luxury = { ac: true, features: ["pushback"] }
    const economy = { ac: false, features: [] }

    // Being upgraded is not a complaint; being downgraded is.
    expect(satisfies(luxury, "economy")).toBe(true)
    expect(satisfies(luxury, "premium")).toBe(true)
    expect(satisfies(economy, "premium")).toBe(false)
    expect(satisfies(economy, "luxury")).toBe(false)
  })

  it("lets every vehicle serve its own segment", () => {
    for (const vehicle of [
      { ac: false, features: [] },
      { ac: true, features: [] },
      { ac: true, features: ["pushback"] },
    ]) {
      expect(satisfies(vehicle, segmentFor(vehicle))).toBe(true)
    }
  })
})

describe("the ladder", () => {
  it("is ordered, and priced in that order", () => {
    expect(rankOf("economy")).toBeLessThan(rankOf("premium"))
    expect(rankOf("premium")).toBeLessThan(rankOf("luxury"))

    expect(SEGMENT_INFO.economy.indicativeIndex).toBeLessThan(SEGMENT_INFO.premium.indicativeIndex)
    expect(SEGMENT_INFO.premium.indicativeIndex).toBeLessThan(SEGMENT_INFO.luxury.indicativeIndex)
  })

  it("promises air conditioning at premium and above, and never at economy", () => {
    expect(SEGMENT_INFO.economy.requires.ac).toBe(false)
    expect(SEGMENT_INFO.premium.requires.ac).toBe(true)
    expect(SEGMENT_INFO.luxury.requires.features).toContain("pushback")
  })

  it("gives every segment a promise a customer can read", () => {
    for (const segment of SEGMENTS) {
      expect(SEGMENT_INFO[segment].promise.length, segment).toBeGreaterThan(20)
      expect(SEGMENT_INFO[segment].includes.length, segment).toBeGreaterThan(1)
    }
  })
})
