import { describe, expect, it } from "vitest"
import {
  checkPing,
  deviationKm,
  geocodeCacheKey,
  hasDeviated,
  haversineKm,
  roundCoordinate,
  routeCacheKey,
  stoppedFor,
} from "./geo.ts"

const madurai = { lat: 9.9252, lng: 78.1198 }
const kodaikanal = { lat: 10.2381, lng: 77.4892 }
const batlagundu = { lat: 10.1667, lng: 77.7833 }
const rameswaram = { lat: 9.2876, lng: 79.3129 }

describe("haversineKm", () => {
  it("measures the straight line between two cities", () => {
    // Madurai to Kodaikanal is about 77 km as the crow flies; the ghat road
    // is half as long again, which is exactly why routing is not geometry.
    expect(haversineKm(madurai, kodaikanal)).toBeGreaterThan(70)
    expect(haversineKm(madurai, kodaikanal)).toBeLessThan(85)
  })

  it("is zero for a point against itself, and symmetric", () => {
    expect(haversineKm(madurai, madurai)).toBe(0)
    expect(haversineKm(madurai, kodaikanal)).toBeCloseTo(haversineKm(kodaikanal, madurai), 9)
  })
})

describe("checkPing", () => {
  it("accepts a position in India, from a string or a number", () => {
    expect(checkPing("9.9252", "78.1198")).toEqual({ ok: true, point: madurai })
    expect(checkPing(9.9252, 78.1198).ok).toBe(true)
  })

  it("rejects Null Island, which is what a chip with no fix reports", () => {
    // Otherwise the tracking page draws a wedding bus in the Atlantic.
    const result = checkPing("0", "0")

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain("no GPS fix")
  })

  it("rejects a position outside India", () => {
    expect(checkPing("51.5074", "-0.1278").ok).toBe(false)
  })

  it("rejects something that is not a number at all", () => {
    expect(checkPing("north", "west").ok).toBe(false)
    expect(checkPing("", "").ok).toBe(false)
  })
})

describe("deviation", () => {
  const route = [madurai, batlagundu, kodaikanal]

  it("measures distance to the nearest point of the planned route", () => {
    expect(deviationKm(batlagundu, route)).toBeCloseTo(0, 6)
    expect(deviationKm({ lat: 9.95, lng: 78.1 }, route)).toBeLessThan(10)
  })

  it("flags a coach that should be near Batlagundu and is halfway to Rameswaram", () => {
    expect(hasDeviated(rameswaram, route)).toBe(true)
  })

  it("does not flag a vehicle a few kilometres off the line", () => {
    // Indian routes wander: a detour to a dhaba is not an incident.
    expect(hasDeviated({ lat: 10.2, lng: 77.7 }, route)).toBe(false)
  })

  it("has no opinion when there is no route to compare against", () => {
    expect(deviationKm(madurai, [])).toBeNull()
    expect(hasDeviated(madurai, [])).toBe(false)
  })
})

describe("stoppedFor", () => {
  const now = new Date("2026-08-10T10:00:00Z")
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

  it("reports how long a vehicle has sat still", () => {
    const stopped = stoppedFor(
      [
        { at: minutesAgo(2), lat: "9.9252", lng: "78.1198" },
        { at: minutesAgo(15), lat: "9.9253", lng: "78.1199" },
        { at: minutesAgo(35), lat: "9.9252", lng: "78.1197" },
        { at: minutesAgo(50), lat: "10.2381", lng: "77.4892" },
      ],
      now,
    )

    expect(stopped).toBe(35)
  })

  it("says nothing when the vehicle is moving", () => {
    expect(
      stoppedFor(
        [
          { at: minutesAgo(1), lat: "9.9252", lng: "78.1198" },
          { at: minutesAgo(30), lat: "10.2381", lng: "77.4892" },
        ],
        now,
      ),
    ).toBeNull()
  })

  it("says nothing when a halt is shorter than the threshold", () => {
    expect(
      stoppedFor(
        [
          { at: minutesAgo(1), lat: "9.9252", lng: "78.1198" },
          { at: minutesAgo(9), lat: "9.9252", lng: "78.1198" },
        ],
        now,
      ),
    ).toBeNull()
  })

  it("survives an empty history and unusable readings", () => {
    expect(stoppedFor([], now)).toBeNull()
    expect(stoppedFor([{ at: minutesAgo(40), lat: "0", lng: "0" }], now)).toBeNull()
  })
})

describe("cache keys", () => {
  it("rounds coordinates so two pins on the same forecourt share a key", () => {
    expect(roundCoordinate(9.92521234)).toBe("9.9252")
    expect(routeCacheKey([madurai, kodaikanal])).toBe(
      routeCacheKey([{ ...madurai, lat: 9.92522 }, kodaikanal]),
    )
  })

  it("distinguishes routes that genuinely differ", () => {
    expect(routeCacheKey([madurai, kodaikanal])).not.toBe(routeCacheKey([kodaikanal, madurai]))
  })

  it("normalises a geocode query, because the same place is typed many ways", () => {
    expect(geocodeCacheKey("  Hotel Germanus,   Madurai ")).toBe(
      geocodeCacheKey("hotel germanus, madurai"),
    )
  })
})
