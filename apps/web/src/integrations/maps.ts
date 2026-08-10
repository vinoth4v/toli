import { geocodeCacheKey, type Point, routeCacheKey } from "@/domain/geo"
import { mapsConfig, osrmBaseUrl } from "./config.ts"

/**
 * Geocoding and routing, behind one interface.
 *
 * §6.1's rule, which this file exists to obey: build a `MapProvider` interface
 * from day one and never let provider SDK types leak into domain code. So
 * everything below returns `GeocodeResult` and `RouteResult` — plain shapes
 * that mean the same thing whichever provider answered — and callers cannot
 * tell Google from Mappls.
 *
 * The division of labour is §6.1's too, and it is about money as much as
 * accuracy. Google is best on urban autocomplete; Mappls is materially better
 * on village names and landmark addresses, which is exactly where a pilgrimage
 * or wedding charter goes; and neither is used for the hundreds of thousands
 * of internal distance calculations, which go to self-hosted OSRM.
 */

export type GeocodeResult = {
  label: string
  point: Point
  /** 0–1. Below `LOW_CONFIDENCE` the next provider is asked. */
  confidence: number
  provider: "google" | "mappls"
}

export type RouteResult = {
  distanceKm: number
  durationMinutes: number
  provider: "osrm"
}

/**
 * Google's own confidence signal is coarse, so the threshold is about what its
 * result *type* says rather than a score: a rooftop match is trusted, a match
 * to an entire town is not, because "Khatu Shyamji" as a town centroid puts
 * the pickup four kilometres from the temple everyone means.
 */
export const LOW_CONFIDENCE = 0.6

type Cache = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, expiresAt: Date | null): Promise<void>
}

/** A no-op cache, so this module can be used before a cache is wired in. */
const noCache: Cache = {
  async get() {
    return null
  },
  async set() {
    // Nothing to do.
  },
}

/* --------------------------------------------------------------- geocoding */

async function geocodeGoogle(query: string, key: string): Promise<GeocodeResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("address", query)
  // India-biased: "Ajmer" should not resolve to a street in Ohio.
  url.searchParams.set("region", "in")
  url.searchParams.set("components", "country:IN")
  url.searchParams.set("key", key)

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Google geocode ${response.status}`)

  const body = (await response.json()) as {
    status?: string
    results?: {
      formatted_address?: string
      geometry?: { location?: { lat?: number; lng?: number }; location_type?: string }
    }[]
  }

  const first = body.results?.[0]
  const location = first?.geometry?.location
  if (!first || typeof location?.lat !== "number" || typeof location?.lng !== "number") return null

  const locationType = first.geometry?.location_type ?? "APPROXIMATE"
  const confidence =
    locationType === "ROOFTOP"
      ? 1
      : locationType === "RANGE_INTERPOLATED"
        ? 0.8
        : locationType === "GEOMETRIC_CENTER"
          ? 0.65
          : 0.4

  return {
    label: first.formatted_address ?? query,
    point: { lat: location.lat, lng: location.lng },
    confidence,
    provider: "google",
  }
}

async function geocodeMappls(query: string, key: string): Promise<GeocodeResult | null> {
  const url = new URL("https://atlas.mapmyindia.com/api/places/geocode")
  url.searchParams.set("address", query)
  url.searchParams.set("itemCount", "1")

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`Mappls geocode ${response.status}`)

  const body = (await response.json()) as {
    copResults?: {
      formattedAddress?: string
      latitude?: number
      longitude?: number
      geocodeLevel?: string
    }
  }

  const result = body.copResults
  if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") {
    return null
  }

  // Mappls names the granularity it matched at, which maps cleanly onto trust.
  const level = result.geocodeLevel ?? "city"
  const confidence =
    level === "houseNumber" || level === "poi"
      ? 1
      : level === "street"
        ? 0.8
        : level === "subLocality"
          ? 0.7
          : 0.5

  return {
    label: result.formattedAddress ?? query,
    point: { lat: result.latitude, lng: result.longitude },
    confidence,
    provider: "mappls",
  }
}

/**
 * Resolves a place, asking Mappls when Google is unsure.
 *
 * The order matters and is the §6.1 recommendation: Google first because it is
 * better on the urban addresses most bookings start from, Mappls second
 * because it is better on everything a charter drives *to*. If Google is not
 * configured, Mappls answers alone, and vice versa.
 */
export async function geocode(
  query: string,
  cache: Cache = noCache,
): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (trimmed === "") return null

  const key = geocodeCacheKey(trimmed)
  const cached = await cache.get(key)
  if (cached) return JSON.parse(cached) as GeocodeResult

  const { googleKey, mapplsKey } = mapsConfig()

  let best: GeocodeResult | null = null

  if (googleKey) {
    best = await geocodeGoogle(trimmed, googleKey)
  }

  if (mapplsKey && (!best || best.confidence < LOW_CONFIDENCE)) {
    const fallback = await geocodeMappls(trimmed, mapplsKey)
    // Keep whichever is more certain rather than assuming the fallback wins.
    if (fallback && (!best || fallback.confidence > best.confidence)) best = fallback
  }

  // §6.2: geocodes are cached forever. A hotel does not move.
  if (best) await cache.set(key, JSON.stringify(best), null)

  return best
}

/* ----------------------------------------------------------------- routing */

/**
 * Road distance and duration from self-hosted OSRM.
 *
 * §6.2 is unambiguous about why this is not a commercial API: every RFQ fans
 * out to a dozen operators and every quote needs a distance, which is hundreds
 * of thousands of calls a month that no user ever sees. One OSRM instance on
 * the India extract costs about ₹8,000 a month; the same volume commercially
 * is ₹4–8 lakh.
 */
export async function route(
  waypoints: readonly Point[],
  cache: Cache = noCache,
): Promise<RouteResult | null> {
  if (waypoints.length < 2) return null

  const key = routeCacheKey(waypoints)
  const cached = await cache.get(key)
  if (cached) return JSON.parse(cached) as RouteResult

  const base = osrmBaseUrl()
  const path = waypoints.map((point) => `${point.lng},${point.lat}`).join(";")

  const response = await fetch(`${base}/route/v1/driving/${path}?overview=false`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`OSRM ${response.status}`)

  const body = (await response.json()) as {
    code?: string
    routes?: { distance?: number; duration?: number }[]
  }

  const first = body.routes?.[0]
  if (body.code !== "Ok" || !first || typeof first.distance !== "number") return null

  const result: RouteResult = {
    // OSRM answers in metres and seconds; this app thinks in km and minutes.
    distanceKm: Math.round(first.distance / 1000),
    durationMinutes: Math.round((first.duration ?? 0) / 60),
    provider: "osrm",
  }

  await cache.set(key, JSON.stringify(result), new Date(Date.now() + ROUTE_TTL_MS))
  return result
}

/** §6.2's 30-day TTL: roads change, and a cached distance should not outlive a diversion. */
const ROUTE_TTL_MS = 30 * 86_400_000

/**
 * §6.4's warning, applied.
 *
 * Google's ETA is tuned for a car. A 26-seat tempo traveller on a ghat road is
 * meaningfully slower and stops more, and the plan says on-time arrival is the
 * single trust metric this business lives on. Until there are ~5,000 trips to
 * train a correction per (vehicle class × road class × time of day), a flat,
 * openly-stated pad is honest and a raw car ETA is not.
 */
export const COACH_ETA_PADDING = 1.25

export function paddedDurationMinutes(carMinutes: number): number {
  return Math.round(carMinutes * COACH_ETA_PADDING)
}
