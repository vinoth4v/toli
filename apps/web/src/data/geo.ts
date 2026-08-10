import { and, eq, gt, isNull, or } from "drizzle-orm"
import { db } from "@/db/client"
import { geoCache, stop, tripRequest } from "@/db/schema"
import { checkPing, type Point } from "@/domain/geo"
import { geocode, paddedDurationMinutes, route } from "@/integrations/maps"

/**
 * The cache §6.2 asks for, backed by a table.
 *
 * "Cache geocode results forever, route distances for common origin-destination
 * pairs with a 30-day TTL, keyed on rounded coordinates." A memory cache would
 * not survive a serverless invocation, and the whole point is that the same
 * Jaipur–Agra pair is asked for by every quote on every RFQ.
 */

const cache = {
  async get(key: string): Promise<string | null> {
    const rows = await db()
      .select({ payload: geoCache.payload })
      .from(geoCache)
      .where(
        and(
          eq(geoCache.key, key),
          // A row with no expiry never expires — that is a geocode.
          or(isNull(geoCache.expiresAt), gt(geoCache.expiresAt, new Date())),
        ),
      )
      .limit(1)

    return rows[0]?.payload ?? null
  },

  async set(key: string, value: string, expiresAt: Date | null): Promise<void> {
    await db()
      .insert(geoCache)
      .values({
        key,
        kind: key.startsWith("route:") ? "route" : "geocode",
        provider: "mixed",
        payload: value,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: geoCache.key,
        set: { payload: value, expiresAt, createdAt: new Date() },
      })
  },
}

export async function geocodeCached(query: string) {
  return geocode(query, cache)
}

export async function routeCached(waypoints: readonly Point[]) {
  return route(waypoints, cache)
}

export type ResolveResult = {
  resolved: number
  failed: string[]
  distanceKm: number | null
  durationMinutes: number | null
}

/**
 * Geocodes an RFQ's stops and measures the road between them.
 *
 * This is where the maps and routing integrations earn their place: the
 * estimated distance stops being a number somebody guessed on the phone and
 * becomes the number every quote is priced against — and the geocoded stops
 * become the route that deviation detection compares live positions to.
 *
 * The duration is padded per §6.4, because Google's ETA is tuned for a car and
 * a 26-seat tempo traveller on a ghat road is meaningfully slower. Being
 * openly approximate beats being confidently wrong when on-time arrival is the
 * trust metric the business lives on.
 */
export async function resolveItinerary(tripRequestId: string): Promise<ResolveResult> {
  const stops = await db()
    .select()
    .from(stop)
    .where(eq(stop.tripRequestId, tripRequestId))
    .orderBy(stop.sequence)

  const failed: string[] = []
  const points: Point[] = []
  let resolved = 0

  for (const entry of stops) {
    const existing =
      entry.lat && entry.lng ? checkPing(entry.lat, entry.lng) : ({ ok: false } as const)

    if (existing.ok) {
      points.push(existing.point)
      continue
    }

    const found = await geocodeCached(entry.label)
    if (!found) {
      failed.push(entry.label)
      continue
    }

    await db()
      .update(stop)
      .set({ lat: found.point.lat.toFixed(6), lng: found.point.lng.toFixed(6) })
      .where(eq(stop.id, entry.id))

    points.push(found.point)
    resolved += 1
  }

  if (points.length < 2) {
    return { resolved, failed, distanceKm: null, durationMinutes: null }
  }

  const measured = await routeCached(points)
  if (!measured) return { resolved, failed, distanceKm: null, durationMinutes: null }

  await db()
    .update(tripRequest)
    .set({ estimatedKm: measured.distanceKm })
    .where(eq(tripRequest.id, tripRequestId))

  return {
    resolved,
    failed,
    distanceKm: measured.distanceKm,
    durationMinutes: paddedDurationMinutes(measured.durationMinutes),
  }
}

/** The geocoded stops of a booking's trip, for deviation checks and the map link. */
export async function routePoints(tripRequestId: string): Promise<Point[]> {
  const stops = await db()
    .select({ lat: stop.lat, lng: stop.lng })
    .from(stop)
    .where(eq(stop.tripRequestId, tripRequestId))
    .orderBy(stop.sequence)

  const points: Point[] = []
  for (const entry of stops) {
    if (!entry.lat || !entry.lng) continue
    const point = checkPing(entry.lat, entry.lng)
    if (point.ok) points.push(point.point)
  }

  return points
}
