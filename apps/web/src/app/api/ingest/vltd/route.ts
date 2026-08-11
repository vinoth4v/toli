import { type NextRequest, NextResponse } from "next/server"
import { deviceForToken, recordPosition } from "@/data/ingest"

/**
 * AIS-140 VLTD ingest — §6.3's "ingest the telematics feed too".
 *
 * Every commercial passenger vehicle in India must carry an AIS-140 tracking
 * device with panic buttons, and most operators already pay a telematics
 * vendor for one. Ingesting that feed gives Toli a position when the driver's
 * phone is dead, out of charge, or in a pocket with location revoked — which
 * on a two-day wedding trip is most of the second day.
 *
 * There is no standard payload. AIS-140 standardises the *device*, not the
 * vendor's webhook, so each vendor invents its own field names: `lat`/`lng`,
 * `latitude`/`longitude`, `gps.lat`, and at least one that sends coordinates
 * as strings with a trailing `N`. The normaliser below is deliberately
 * forgiving about names and strict about values — a coordinate that cannot be
 * read as a number in India is rejected, whatever it was called.
 */

export const dynamic = "force-dynamic"

type Unknown = Record<string, unknown>

function pick(source: Unknown, names: string[]): unknown {
  for (const name of names) {
    const value = source[name]
    if (value !== undefined && value !== null && value !== "") return value
  }
  return undefined
}

/** Strips the compass suffix some vendors append: "26.9124N" → "26.9124". */
function coordinate(value: unknown): string | null {
  if (typeof value === "number") return String(value)
  if (typeof value !== "string") return null
  const cleaned = value.trim().replace(/[NSEW]$/i, "")
  return cleaned === "" ? null : cleaned
}

type Reading = { lat: string; lng: string; speedKmph: number | null; recordedAt: Date | null }

export function normaliseReading(raw: unknown): Reading | null {
  if (typeof raw !== "object" || raw === null) return null
  const source = raw as Unknown

  // Some vendors nest the fix under `gps`, `location` or `position`.
  const nested = (pick(source, ["gps", "location", "position"]) ?? {}) as Unknown
  const from = (names: string[]) => pick(source, names) ?? pick(nested, names)

  const lat = coordinate(from(["lat", "latitude", "Latitude", "LAT"]))
  const lng = coordinate(from(["lng", "lon", "long", "longitude", "Longitude", "LNG"]))
  if (!lat || !lng) return null

  const rawSpeed = from(["speed", "speedKmph", "spd", "Speed"])
  const speed = typeof rawSpeed === "number" ? rawSpeed : Number.parseFloat(String(rawSpeed ?? ""))

  const rawTime = from(["timestamp", "time", "deviceTime", "gpsTime", "dt"])
  const recordedAt =
    typeof rawTime === "string" || typeof rawTime === "number"
      ? new Date(typeof rawTime === "number" && rawTime < 1e12 ? rawTime * 1000 : rawTime)
      : null

  return {
    lat,
    lng,
    speedKmph: Number.isFinite(speed) && speed >= 0 && speed <= 200 ? Math.round(speed) : null,
    recordedAt: recordedAt && !Number.isNaN(recordedAt.getTime()) ? recordedAt : null,
  }
}

/** A vendor may send one reading, an array, or an array under a wrapper key. */
export function readingsFrom(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (typeof body !== "object" || body === null) return []

  const source = body as Unknown
  for (const key of ["data", "records", "packets", "positions", "events"]) {
    const value = source[key]
    if (Array.isArray(value)) return value
  }

  return [body]
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // The token identifies the box, and the box identifies the vehicle — which
  // is why a VLTD device needs no booking id: it is bolted to one vehicle, and
  // that vehicle is either on a trip or it is not.
  const header = request.headers.get("authorization")?.split(" ") ?? []
  const token =
    header[0]?.toLowerCase() === "bearer"
      ? (header[1] ?? null)
      : request.headers.get("x-device-token")

  const device = await deviceForToken(token)
  if (device?.kind !== "vltd") {
    return NextResponse.json({ error: "Unknown or revoked device token" }, { status: 401 })
  }

  const readings = readingsFrom(await request.json().catch(() => null))
  if (readings.length === 0) {
    return NextResponse.json({ error: "No readings in payload" }, { status: 400 })
  }

  let accepted = 0
  let unreadable = 0
  let offTrip = 0

  for (const raw of readings.slice(0, 500)) {
    const reading = normaliseReading(raw)
    if (!reading) {
      unreadable += 1
      continue
    }

    const result = await recordPosition({
      device,
      bookingId: null,
      lat: reading.lat,
      lng: reading.lng,
      speedKmph: reading.speedKmph,
      recordedAt: reading.recordedAt,
    })

    if (result.ok) accepted += 1
    else if (result.status === 202) offTrip += 1
    else unreadable += 1
  }

  // Always 200 to a vendor that authenticated: a telematics platform that gets
  // a 4xx typically disables the webhook after a few failures, and losing the
  // feed is worse than losing a reading.
  return NextResponse.json({ accepted, offTrip, unreadable })
}
