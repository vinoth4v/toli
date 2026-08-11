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

const jaipur = { lat: 26.9124, lng: 75.7873 }
const agra = { lat: 27.1767, lng: 78.0081 }
const fatehpurSikri = { lat: 27.0945, lng: 77.6679 }

describe("haversineKm", () => {
  it("measures the straight line between two cities", () => {
    // Jaipur to Agra is ~220 km as the crow flies; the road is ~240.
    expect(haversineKm(jaipur, agra)).toBeGreaterThan(210)
    expect(haversineKm(jaipur, agra)).toBeLessThan(230)
  })

  it("is zero for a point against itself, and symmetric", () => {
    expect(haversineKm(jaipur, jaipur)).toBe(0)
    expect(haversineKm(jaipur, agra)).toBeCloseTo(haversineKm(agra, jaipur), 9)
  })
})

describe("checkPing", () => {
  it("accepts a position in India, from a string or a number", () => {
    expect(checkPing("26.9124", "75.7873")).toEqual({ ok: true, point: jaipur })
    expect(checkPing(26.9124, 75.7873).ok).toBe(true)
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
  const route = [jaipur, fatehpurSikri, agra]

  it("measures distance to the nearest point of the planned route", () => {
    expect(deviationKm(fatehpurSikri, route)).toBeCloseTo(0, 6)
    expect(deviationKm({ lat: 26.95, lng: 75.8 }, route)).toBeLessThan(10)
  })

  it("flags a coach that should be near Fatehpur Sikri and is not", () => {
    expect(hasDeviated({ lat: 26.2389, lng: 73.0243 }, route)).toBe(true)
  })

  it("does not flag a vehicle a few kilometres off the line", () => {
    // Indian routes wander: a detour to a dhaba is not an incident.
    expect(hasDeviated({ lat: 27.1, lng: 77.7 }, route)).toBe(false)
  })

  it("has no opinion when there is no route to compare against", () => {
    expect(deviationKm(jaipur, [])).toBeNull()
    expect(hasDeviated(jaipur, [])).toBe(false)
  })
})

describe("stoppedFor", () => {
  const now = new Date("2026-08-10T10:00:00Z")
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

  it("reports how long a vehicle has sat still", () => {
    const stopped = stoppedFor(
      [
        { at: minutesAgo(2), lat: "26.9124", lng: "75.7873" },
        { at: minutesAgo(15), lat: "26.9125", lng: "75.7874" },
        { at: minutesAgo(35), lat: "26.9124", lng: "75.7872" },
        { at: minutesAgo(50), lat: "27.1767", lng: "78.0081" },
      ],
      now,
    )

    expect(stopped).toBe(35)
  })

  it("says nothing when the vehicle is moving", () => {
    expect(
      stoppedFor(
        [
          { at: minutesAgo(1), lat: "26.9124", lng: "75.7873" },
          { at: minutesAgo(30), lat: "27.1767", lng: "78.0081" },
        ],
        now,
      ),
    ).toBeNull()
  })

  it("says nothing when a halt is shorter than the threshold", () => {
    expect(
      stoppedFor(
        [
          { at: minutesAgo(1), lat: "26.9124", lng: "75.7873" },
          { at: minutesAgo(9), lat: "26.9124", lng: "75.7873" },
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
    expect(roundCoordinate(26.91241234)).toBe("26.9124")
    expect(routeCacheKey([jaipur, agra])).toBe(routeCacheKey([{ ...jaipur, lat: 26.91242 }, agra]))
  })

  it("distinguishes routes that genuinely differ", () => {
    expect(routeCacheKey([jaipur, agra])).not.toBe(routeCacheKey([agra, jaipur]))
  })

  it("normalises a geocode query, because the same place is typed many ways", () => {
    expect(geocodeCacheKey("  Hotel Clarks Amer,   Jaipur ")).toBe(
      geocodeCacheKey("hotel clarks amer, jaipur"),
    )
  })
})
