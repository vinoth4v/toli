/**
 * The geometry the app does for itself.
 *
 * §6 hands routing and geocoding to providers, but three things stay here
 * because they run on every GPS ping and must not cost a network call: how far
 * apart two points are, whether a vehicle has wandered off its route, and what
 * cache key a coordinate pair belongs to.
 */

export type Point = { lat: number; lng: number }

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Great-circle distance in kilometres.
 *
 * Straight-line, not road distance — used for "has this vehicle moved", "is
 * this ping plausible" and "how far off the route is it", never for pricing. A
 * quote's distance comes from OSRM, because the road between Jaipur and Agra
 * is 240 km and the line between them is 190.
 */
export function haversineKm(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** India's bounding box, generously drawn. A ping outside it is a bug or a spoof. */
const INDIA_BOUNDS = { minLat: 6, maxLat: 37.5, minLng: 68, maxLng: 97.5 }

export type PingCheck = { ok: true; point: Point } | { ok: false; reason: string }

/**
 * Validates a position before it is stored.
 *
 * A GPS chip that has lost its fix reports 0,0 — the Gulf of Guinea — and a
 * tracking page that draws that shows a wedding bus in the Atlantic. Rejecting
 * it here is cheaper than explaining it later.
 */
export function checkPing(rawLat: string | number, rawLng: string | number): PingCheck {
  const lat = typeof rawLat === "number" ? rawLat : Number.parseFloat(rawLat)
  const lng = typeof rawLng === "number" ? rawLng : Number.parseFloat(rawLng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "Coordinates are not numbers" }
  }
  if (lat === 0 && lng === 0) {
    return { ok: false, reason: "Null Island — the device has no GPS fix" }
  }
  if (
    lat < INDIA_BOUNDS.minLat ||
    lat > INDIA_BOUNDS.maxLat ||
    lng < INDIA_BOUNDS.minLng ||
    lng > INDIA_BOUNDS.maxLng
  ) {
    return { ok: false, reason: "Outside India" }
  }

  return { ok: true, point: { lat, lng } }
}

/**
 * §6.3's deviation detection, in the form the ops desk needs: how far the
 * vehicle is from the nearest point of its planned route.
 *
 * Distance to the nearest *stop* rather than to the road line, because the
 * route geometry is only known when OSRM is configured and the stops are
 * always known. Coarser, and it still catches the case that matters — a coach
 * that should be near Fatehpur Sikri and is eighty kilometres away.
 */
export const DEVIATION_THRESHOLD_KM = 25

export function deviationKm(position: Point, route: readonly Point[]): number | null {
  if (route.length === 0) return null
  return Math.min(...route.map((waypoint) => haversineKm(position, waypoint)))
}

export function hasDeviated(position: Point, route: readonly Point[]): boolean {
  const distance = deviationKm(position, route)
  return distance !== null && distance > DEVIATION_THRESHOLD_KM
}

/**
 * §6.3's unexplained stop: no meaningful movement for twenty minutes while a
 * trip is supposed to be running.
 *
 * Pings are newest-first, as they come out of the database.
 */
export const STOPPED_THRESHOLD_MINUTES = 20
export const STOPPED_RADIUS_KM = 0.5

export function stoppedFor(
  pings: readonly { at: Date; lat: string; lng: string }[],
  now: Date,
): number | null {
  const latest = pings[0]
  if (!latest) return null

  const anchor = checkPing(latest.lat, latest.lng)
  if (!anchor.ok) return null

  let since = latest.at
  for (const ping of pings.slice(1)) {
    const point = checkPing(ping.lat, ping.lng)
    if (!point.ok) continue
    if (haversineKm(anchor.point, point.point) > STOPPED_RADIUS_KM) break
    since = ping.at
  }

  const minutes = (now.getTime() - since.getTime()) / 60_000
  return minutes >= STOPPED_THRESHOLD_MINUTES ? Math.round(minutes) : null
}

/**
 * Cache keys for geocodes and routes.
 *
 * §6.2: cache route distances "keyed on rounded coordinates". Four decimal
 * places is about eleven metres, which is far finer than any charter needs and
 * coarse enough that two pins dropped on the same hotel forecourt share a key.
 */
export function roundCoordinate(value: number): string {
  return value.toFixed(4)
}

export function geocodeCacheKey(query: string): string {
  return `geocode:${query.trim().toLowerCase().replace(/\s+/g, " ")}`
}

export function routeCacheKey(waypoints: readonly Point[]): string {
  const path = waypoints
    .map((point) => `${roundCoordinate(point.lat)},${roundCoordinate(point.lng)}`)
    .join(";")
  return `route:${path}`
}

/** Geocodes never expire; routes get 30 days, per §6.2. */
export const ROUTE_CACHE_TTL_MS = 30 * 86_400_000

/**
 * A Google Maps link for a position.
 *
 * §6.1 says to deep-link out rather than build navigation, and the tracking
 * page and the ops desk both just need "show me where this is".
 */
export function mapLink(point: Point): string {
  return `https://www.google.com/maps?q=${roundCoordinate(point.lat)},${roundCoordinate(point.lng)}`
}
