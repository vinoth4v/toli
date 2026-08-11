"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { resolveItinerary } from "@/data/geo"
import { issueDevice, revokeDevice } from "@/data/ingest"
import { markSentByHand } from "@/data/notifications"
import { recordComplianceCheck, setDocumentVerification } from "@/data/supply"
import { recordEvent } from "@/db/events"
import { NotConfiguredError } from "@/integrations/config"
import { verifyGstin, verifyRegistration } from "@/integrations/verification"

/**
 * Actions for the integrations themselves: enrolling a tracking device,
 * running a government check, resolving an itinerary, and clearing an outbox
 * message that was sent by hand.
 */

async function actor(): Promise<string | null> {
  const session = await auth()
  return session?.user?.email ?? null
}

function fail(path: string, error: unknown): never {
  const message =
    error instanceof NotConfiguredError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Something went wrong"

  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

/**
 * Enrols a device and shows its token exactly once.
 *
 * The token travels back in the URL because it can never be recovered
 * afterwards — only its SHA-256 is stored — and the operator has to be able to
 * paste it into a phone or a telematics vendor's console. It is a redirect
 * rather than a stored flash message so that reloading the page does not keep
 * a live credential on screen.
 */
export async function enrolDeviceAction(formData: FormData): Promise<void> {
  const kind = String(formData.get("kind") ?? "") === "vltd" ? "vltd" : "driver_app"
  const label = String(formData.get("label") ?? "").trim()
  const vehicleId = String(formData.get("vehicleId") ?? "").trim() || null
  const operatorId = String(formData.get("operatorId") ?? "").trim() || null
  const driverId = String(formData.get("driverId") ?? "").trim() || null
  const vendor = String(formData.get("vendor") ?? "").trim() || null

  if (label === "") return

  const { token } = await issueDevice({ kind, label, operatorId, vehicleId, driverId, vendor })
  await recordEvent("vehicle_assigned", await actor(), `ingest device enrolled: ${label}`)

  redirect(`/console/integrations?token=${encodeURIComponent(token)}`)
}

export async function revokeDeviceAction(formData: FormData): Promise<void> {
  const id = String(formData.get("deviceId") ?? "")
  if (!id) return

  await revokeDevice(id)
  await recordEvent("vehicle_status_changed", await actor(), `ingest device revoked: ${id}`)
  revalidatePath("/console/integrations")
}

/**
 * Asks VAHAN about a vehicle, and records what it said.
 *
 * The answer lands in `compliance_check` — the same table an ops person writes
 * to when they read the portal by hand — so the verification queue does not
 * care which of the two happened.
 */
export async function verifyVehicleAction(formData: FormData): Promise<void> {
  const vehicleId = String(formData.get("vehicleId") ?? "")
  const registration = String(formData.get("registrationNumber") ?? "")
  const documentId = String(formData.get("documentId") ?? "").trim()
  const operatorId = String(formData.get("operatorId") ?? "").trim()
  const back = operatorId ? `/operators/${operatorId}` : "/compliance"

  if (!vehicleId || !registration) return

  try {
    const outcome = await verifyRegistration(registration)

    await recordComplianceCheck({
      entityType: "vehicle",
      entityId: vehicleId,
      source: "vahan",
      passed: outcome.passed,
      result: outcome.summary,
    })

    // A document is only marked verified when the source actually confirmed
    // it. A failed lookup leaves it pending for a person to look at, because
    // "the API was down" is not "the paperwork is bad".
    if (documentId && outcome.passed) {
      await setDocumentVerification(documentId, "verified", outcome.summary)
    }

    await recordEvent(
      "compliance_check_recorded",
      await actor(),
      `VAHAN ${registration}: ${outcome.summary}`,
    )
  } catch (error) {
    fail(back, error)
  }

  revalidatePath(back)
  revalidatePath("/console/compliance")
}

export async function verifyGstinAction(formData: FormData): Promise<void> {
  const operatorId = String(formData.get("operatorId") ?? "")
  const gstin = String(formData.get("gstin") ?? "")
  if (!operatorId || !gstin) return

  try {
    const outcome = await verifyGstin(gstin)

    await recordComplianceCheck({
      entityType: "operator",
      entityId: operatorId,
      source: "gstn",
      passed: outcome.passed,
      result: outcome.summary,
    })

    await recordEvent(
      "compliance_check_recorded",
      await actor(),
      `GSTN ${gstin}: ${outcome.summary}`,
    )
  } catch (error) {
    fail(`/operators/${operatorId}`, error)
  }

  revalidatePath(`/console/operators/${operatorId}`)
}

/**
 * Geocodes an RFQ's stops and measures the road between them.
 *
 * Fills in the estimated distance every quote is priced against, and gives
 * live tracking a route to detect deviation from.
 */
export async function resolveItineraryAction(formData: FormData): Promise<void> {
  const tripRequestId = String(formData.get("tripRequestId") ?? "")
  if (!tripRequestId) return

  try {
    const result = await resolveItinerary(tripRequestId)

    if (result.failed.length > 0 && result.distanceKm === null) {
      redirect(
        `/rfqs/${tripRequestId}?error=${encodeURIComponent(
          `Could not place: ${result.failed.join(", ")}`,
        )}`,
      )
    }
  } catch (error) {
    fail(`/rfqs/${tripRequestId}`, error)
  }

  revalidatePath(`/console/rfqs/${tripRequestId}`)
}

export async function markSentByHandAction(formData: FormData): Promise<void> {
  const id = String(formData.get("notificationId") ?? "")
  if (!id) return

  await markSentByHand(id)
  revalidatePath("/console/integrations")
}
