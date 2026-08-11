import { describe, expect, it } from "vitest"
import { normaliseReading, readingsFrom } from "@/app/api/ingest/vltd/route"

/**
 * AIS-140 standardises the device, not the vendor's webhook. These are the
 * payload shapes real Indian telematics vendors actually send — which is the
 * whole reason the normaliser exists, and the reason it is tested rather than
 * trusted.
 */

describe("normaliseReading", () => {
  it("reads the plain shape", () => {
    expect(normaliseReading({ lat: 26.9124, lng: 75.7873, speed: 48 })).toMatchObject({
      lat: "26.9124",
      lng: "75.7873",
      speedKmph: 48,
    })
  })

  it("reads the long field names", () => {
    expect(normaliseReading({ latitude: "26.9124", longitude: "75.7873" })).toMatchObject({
      lat: "26.9124",
      lng: "75.7873",
    })
  })

  it("reads a fix nested under gps, location or position", () => {
    for (const key of ["gps", "location", "position"]) {
      const reading = normaliseReading({ [key]: { lat: "26.9124", lon: "75.7873" } })
      expect(reading, key).toMatchObject({ lat: "26.9124", lng: "75.7873" })
    }
  })

  it("strips the compass suffix one vendor appends", () => {
    expect(normaliseReading({ lat: "26.9124N", lng: "75.7873E" })).toMatchObject({
      lat: "26.9124",
      lng: "75.7873",
    })
  })

  it("reads a timestamp in seconds or in ISO", () => {
    const seconds = normaliseReading({ lat: 26.9, lng: 75.7, timestamp: 1786137532 })
    expect(seconds?.recordedAt?.getUTCFullYear()).toBe(2026)

    const iso = normaliseReading({ lat: 26.9, lng: 75.7, deviceTime: "2026-08-10T06:30:00Z" })
    expect(iso?.recordedAt?.toISOString()).toBe("2026-08-10T06:30:00.000Z")
  })

  it("drops a speed that is not a plausible road speed", () => {
    expect(normaliseReading({ lat: 26.9, lng: 75.7, speed: 999 })?.speedKmph).toBeNull()
    expect(normaliseReading({ lat: 26.9, lng: 75.7, speed: "not a number" })?.speedKmph).toBeNull()
  })

  it("refuses a reading with no usable coordinates", () => {
    expect(normaliseReading({ speed: 40 })).toBeNull()
    expect(normaliseReading({ lat: "", lng: "" })).toBeNull()
    expect(normaliseReading("nonsense")).toBeNull()
    expect(normaliseReading(null)).toBeNull()
  })
})

describe("readingsFrom", () => {
  it("accepts a bare array, a single object, and the common wrappers", () => {
    expect(readingsFrom([{ lat: 1 }, { lat: 2 }])).toHaveLength(2)
    expect(readingsFrom({ lat: 1 })).toHaveLength(1)

    for (const key of ["data", "records", "packets", "positions", "events"]) {
      expect(readingsFrom({ [key]: [{ lat: 1 }, { lat: 2 }] }), key).toHaveLength(2)
    }
  })

  it("returns nothing for a payload that is not readable at all", () => {
    expect(readingsFrom(null)).toEqual([])
    expect(readingsFrom("garbage")).toEqual([])
  })
})
