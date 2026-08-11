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
 * quote's distance comes from OSRM, because the road from Madurai up to
 * Kodaikanal is 120 km of ghat and the line between them is 75.
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

/** Turn-by-turn, handed to the app the driver already uses. §6.1: never build this. */
export function navigationLink(point: Point): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${roundCoordinate(point.lat)},${roundCoordinate(point.lng)}`
}

/**
 * A map to embed, from OpenStreetMap.
 *
 * §6.1 gives map *rendering* to Google's mobile SDK, which does not apply to a
 * web page — and the Maps Embed API needs the billing account this app does
 * not have yet. OSM's embed needs no key, costs nothing, and shows the one
 * thing a page like this must show: where the vehicle is, on a map, without a
 * customer having to leave for another tab.
 *
 * The trade is honest and worth writing down: OSM's Indian street data is
 * thinner than Google's, which is precisely why §6.1 recommends Mappls for
 * village-level work. This is the free tier of a map, and the "open in Maps"
 * link beside it is there for when it is not enough.
 */
export function embedUrl(point: Point, spanDegrees = 0.08): string {
  const west = (point.lng - spanDegrees).toFixed(4)
  const east = (point.lng + spanDegrees).toFixed(4)
  const south = (point.lat - spanDegrees / 2).toFixed(4)
  const north = (point.lat + spanDegrees / 2).toFixed(4)

  return (
    "https://www.openstreetmap.org/export/embed.html" +
    `?bbox=${west}%2C${south}%2C${east}%2C${north}` +
    "&layer=mapnik" +
    `&marker=${roundCoordinate(point.lat)}%2C${roundCoordinate(point.lng)}`
  )
}

/**
 * A box that holds every point given, with a margin.
 *
 * Used to frame a whole route rather than a single marker. A single point, or
 * points very close together, would otherwise produce a zero-width box and a
 * map zoomed to the whole world.
 */
export function boundsFor(points: readonly Point[]): { centre: Point; span: number } | null {
  if (points.length === 0) return null

  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  return {
    centre: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
    // A floor, so one stop does not zoom to the whole planet, and a margin so
    // the outermost markers are not hard against the edge.
    span: Math.max(0.05, (maxLng - minLng) * 1.4, (maxLat - minLat) * 1.4),
  }
}
