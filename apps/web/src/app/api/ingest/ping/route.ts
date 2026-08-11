import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { deviceForToken, recordPosition } from "@/data/ingest"

/**
 * Where the driver app posts its position.
 *
 * §6.3: a foreground service pinging roughly every ten seconds while a trip is
 * active, sixty while idle, with everything buffered locally when there is no
 * signal — half of these trips pass through zones with no data. So this
 * endpoint accepts either one position or a replayed batch of them, and is
 * idempotent enough not to care if a buffer is flushed twice.
 *
 * Authenticated by a device token, not a session: the phone holding it is not
 * signed in as the operator and must never be able to reach anything else.
 * That is why `track` and this path are the only holes in the proxy matcher.
 */

export const dynamic = "force-dynamic"

const positionSchema = z.object({
  lat: z.union([z.string(), z.number()]),
  lng: z.union([z.string(), z.number()]),
  speedKmph: z.number().min(0).max(200).nullish(),
  /** When the fix was taken, which for a replayed buffer is not now. */
  recordedAt: z.string().datetime().nullish(),
})

const bodySchema = z.object({
  bookingId: z.string().uuid().nullish(),
  positions: z.array(positionSchema).min(1).max(500),
})

function bearer(request: NextRequest): string | null {
  const header = request.headers.get("authorization")
  if (!header) return null
  const [scheme, value] = header.split(" ")
  return scheme?.toLowerCase() === "bearer" && value ? value : null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const device = await deviceForToken(bearer(request))
  if (!device) {
    return NextResponse.json({ error: "Unknown or revoked device token" }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { positions: [{ lat, lng }] }" }, { status: 400 })
  }

  const accepted: string[] = []
  const rejected: { reason: string }[] = []
  let deviation: number | null = null

  for (const position of parsed.data.positions) {
    const result = await recordPosition({
      device,
      bookingId: parsed.data.bookingId ?? null,
      lat: String(position.lat),
      lng: String(position.lng),
      speedKmph: position.speedKmph ?? null,
      recordedAt: position.recordedAt ? new Date(position.recordedAt) : null,
    })

    if (result.ok) {
      accepted.push(result.bookingId)
      if (result.deviationKm !== null) deviation = result.deviationKm
    } else {
      rejected.push({ reason: result.reason })
    }
  }

  // 200 even when every position was rejected for being off-trip: the device
  // is behaving correctly and must not retry a buffer forever. A 4xx here is
  // reserved for the device being wrong about who it is or what it sent.
  return NextResponse.json({
    accepted: accepted.length,
    rejected: rejected.length,
    reasons: rejected.slice(0, 5).map((entry) => entry.reason),
    ...(deviation === null ? {} : { deviationKm: deviation }),
  })
}
