import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import {
  assignment,
  booking,
  type IngestDevice,
  ingestDevice,
  locationPing,
  operator,
  stop,
  tripEvent,
  tripRequest,
  vehicle,
} from "@/db/schema"
import { checkPing, DEVIATION_THRESHOLD_KM, deviationKm, type Point } from "@/domain/geo"

/**
 * Position ingest — the driver app's pings and an AIS-140 VLTD feed.
 *
 * This is the one of the five integrations that needs nobody's permission:
 * the driver app posts here, and §6.3's VLTD adapters post here too. Ingesting
 * the telematics feed matters more than it sounds — it gives Toli tracking
 * even when the driver's phone dies, which it will, on a trip where the one
 * thing the customer is paying for is seeing the bus on a map.
 *
 * A device authenticates with a bearer token it was issued once. Only the
 * SHA-256 is stored: a leaked ingest token lets someone forge a vehicle's
 * position, and a family watching a tracking link would have no way to know.
 */

const TOKEN_BYTES = 24

export type IssuedDevice = { device: IngestDevice; token: string }

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Enrols a device and returns its token once.
 *
 * The plaintext is never stored and cannot be recovered — the ops screen shows
 * it at enrolment and then only ever the last four characters, which is enough
 * to answer "is this the token on that box".
 */
export async function issueDevice(input: {
  kind: "driver_app" | "vltd"
  label: string
  operatorId: string | null
  vehicleId: string | null
  driverId: string | null
  vendor: string | null
}): Promise<IssuedDevice> {
  const token = `tlk_${randomBytes(TOKEN_BYTES).toString("base64url")}`

  const created = await db()
    .insert(ingestDevice)
    .values({
      ...input,
      tokenHash: hash(token),
      tokenLastFour: token.slice(-4),
    })
    .returning()

  const device = created[0]
  if (!device) throw new Error("device could not be enrolled")
  return { device, token }
}

/**
 * Resolves a bearer token to a device.
 *
 * The lookup is by hash, which is an indexed equality test, and the result is
 * compared again in constant time. That second compare is belt and braces —
 * the index has already done an exact match — but it costs nothing and means
 * no future refactor to a scan-and-compare quietly introduces a timing oracle.
 */
export async function deviceForToken(token: string | null): Promise<IngestDevice | null> {
  if (!token || token.trim() === "") return null

  const digest = hash(token.trim())
  const rows = await db()
    .select()
    .from(ingestDevice)
    .where(and(eq(ingestDevice.tokenHash, digest), eq(ingestDevice.active, true)))
    .limit(1)

  const device = rows[0]
  if (!device) return null

  const a = Buffer.from(device.tokenHash, "utf8")
  const b = Buffer.from(digest, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return device
}

export async function listDevices() {
  return db()
    .select({
      device: ingestDevice,
      operatorName: operator.name,
      registration: vehicle.registrationNumber,
    })
    .from(ingestDevice)
    .leftJoin(operator, eq(ingestDevice.operatorId, operator.id))
    .leftJoin(vehicle, eq(ingestDevice.vehicleId, vehicle.id))
    .orderBy(desc(ingestDevice.createdAt))
}

export async function revokeDevice(id: string): Promise<void> {
  await db().update(ingestDevice).set({ active: false }).where(eq(ingestDevice.id, id))
}

/**
 * The booking a device's position belongs to.
 *
 * A VLTD box is bolted to a vehicle, so its pings belong to whichever trip
 * that vehicle is currently running; a driver's phone is told which booking it
 * is on. Either way a position is only accepted against a trip that is
 * actually out — a box that keeps transmitting in the yard overnight must not
 * append to yesterday's completed trip.
 */
export async function activeBookingForVehicle(vehicleId: string): Promise<string | null> {
  const rows = await db()
    .select({ id: booking.id })
    .from(booking)
    .innerJoin(assignment, eq(assignment.bookingId, booking.id))
    .where(
      and(eq(assignment.vehicleId, vehicleId), inArray(booking.status, ["assigned", "in_transit"])),
    )
    .orderBy(desc(assignment.assignedAt))
    .limit(1)

  return rows[0]?.id ?? null
}

export async function bookingIsLive(bookingId: string): Promise<boolean> {
  const rows = await db()
    .select({ status: booking.status })
    .from(booking)
    .where(eq(booking.id, bookingId))
    .limit(1)

  const status = rows[0]?.status
  return status === "assigned" || status === "in_transit"
}

export type IngestResult =
  | { ok: true; bookingId: string; deviated: boolean; deviationKm: number | null }
  | { ok: false; status: number; reason: string }

/**
 * Records one position.
 *
 * Two things happen beyond the insert, both from §6.3. The position is checked
 * for plausibility first — a chip with no fix reports 0,0, and a tracking page
 * that draws the Gulf of Guinea is worse than one that draws nothing. And the
 * distance from the planned route is measured, so a vehicle that has wandered
 * raises a `deviation` event rather than waiting for a customer to phone.
 */
export async function recordPosition(input: {
  device: IngestDevice
  bookingId: string | null
  lat: string
  lng: string
  speedKmph: number | null
  recordedAt: Date | null
}): Promise<IngestResult> {
  const position = checkPing(input.lat, input.lng)
  if (!position.ok) return { ok: false, status: 422, reason: position.reason }

  const bookingId =
    input.bookingId ??
    (input.device.vehicleId ? await activeBookingForVehicle(input.device.vehicleId) : null)

  if (!bookingId) {
    // Not an error: a box transmits from the yard all night. Accepting it and
    // storing it against nothing would fill the table with noise.
    return { ok: false, status: 202, reason: "No live trip for this device" }
  }

  if (!(await bookingIsLive(bookingId))) {
    return { ok: false, status: 202, reason: "That trip is not running" }
  }

  await db()
    .insert(locationPing)
    .values({
      bookingId,
      lat: position.point.lat.toFixed(6),
      lng: position.point.lng.toFixed(6),
      speedKmph: input.speedKmph,
      source:
        input.device.kind === "vltd" ? `vltd:${input.device.vendor ?? "unknown"}` : "driver_app",
      ...(input.recordedAt ? { at: input.recordedAt } : {}),
    })

  await db()
    .update(ingestDevice)
    .set({ lastSeenAt: new Date() })
    .where(eq(ingestDevice.id, input.device.id))

  const drift = await checkDeviation(bookingId, position.point)

  return { ok: true, bookingId, deviated: drift !== null, deviationKm: drift }
}

/**
 * Raises a deviation event when a vehicle is far from every planned stop.
 *
 * Only once per trip: a coach eighty kilometres off route stays off route for
 * an hour, and an event per ping would bury the ops desk in the same alert
 * two hundred times.
 */
async function checkDeviation(bookingId: string, position: Point): Promise<number | null> {
  const waypoints = await db()
    .select({ lat: stop.lat, lng: stop.lng })
    .from(stop)
    .innerJoin(tripRequest, eq(stop.tripRequestId, tripRequest.id))
    .innerJoin(booking, eq(booking.tripRequestId, tripRequest.id))
    .where(eq(booking.id, bookingId))

  const route: Point[] = []
  for (const waypoint of waypoints) {
    if (!waypoint.lat || !waypoint.lng) continue
    const point = checkPing(waypoint.lat, waypoint.lng)
    if (point.ok) route.push(point.point)
  }

  // No geocoded stops means no route to compare against. That is the state
  // whenever the maps integration is unconfigured, and it is not an error.
  if (route.length === 0) return null

  const distance = deviationKm(position, route)
  if (distance === null || distance <= DEVIATION_THRESHOLD_KM) return null

  const already = await db()
    .select({ id: tripEvent.id })
    .from(tripEvent)
    .where(and(eq(tripEvent.bookingId, bookingId), eq(tripEvent.kind, "deviation")))
    .limit(1)

  if (already.length === 0) {
    await db()
      .insert(tripEvent)
      .values({
        bookingId,
        kind: "deviation",
        detail: `${Math.round(distance)} km from the nearest planned stop`,
        lat: position.lat.toFixed(6),
        lng: position.lng.toFixed(6),
      })
  }

  return Math.round(distance)
}
