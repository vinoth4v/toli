"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { addExpense, addPing, addTripEvent } from "@/data/fulfilment"
import { driverOwnsBooking } from "@/data/scoped"
import { recordEvent } from "@/db/events"
import { checkPing } from "@/domain/geo"
import { parseRupeesToPaise } from "@/domain/money"

/**
 * The three things a driver does.
 *
 * Start the trip, finish the trip, and record what they spent on the road. Each
 * one checks that this driver is actually assigned to this booking — a driver
 * cannot start somebody else's trip by editing a form field.
 */

async function driverId(): Promise<string> {
  const session = await auth()
  const id = session?.user.driverId
  if (!id || session?.user.role !== "driver") redirect("/login")
  return id
}

async function assertOwn(bookingId: string): Promise<void> {
  const id = await driverId()
  if (!(await driverOwnsBooking(id, bookingId))) redirect("/drive")
}

/**
 * A position from the driver's own phone.
 *
 * Takes an object rather than a FormData because it is called from a client
 * component holding a `GeolocationPosition`, not from a form — and the
 * driver's session is the credential, so no ingest token has to live on a
 * phone that gets lost.
 *
 * The same plausibility check the ingest endpoint applies runs here: a browser
 * with no fix reports 0,0 as readily as a cheap GPS chip does.
 */
export async function shareLocationAction(input: {
  bookingId: string
  lat: string
  lng: string
  speedKmph: number | null
}): Promise<void> {
  if (!input.bookingId) return
  await assertOwn(input.bookingId)

  const position = checkPing(input.lat, input.lng)
  if (!position.ok) return

  await addPing({
    bookingId: input.bookingId,
    lat: position.point.lat.toFixed(6),
    lng: position.point.lng.toFixed(6),
    speedKmph: input.speedKmph,
    source: "driver_browser",
  })

  revalidatePath(`/drive/${input.bookingId}`)
}

/**
 * Starting a trip: OTP from the passenger, and the odometer.
 *
 * §4.2's trip lifecycle wants an odometer photograph at both ends. There is no
 * upload here yet, so the reading is typed — the number is what settlement and
 * any distance dispute actually need, and a photo without the number still
 * leaves someone squinting at a picture.
 */
export async function startTripAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  if (!bookingId) return
  await assertOwn(bookingId)

  const odometer = String(formData.get("odometerKm") ?? "").trim()

  await addTripEvent({
    bookingId,
    kind: "started",
    detail: "Started by driver",
    odometerKm: odometer === "" ? null : Number(odometer),
    lat: String(formData.get("lat") ?? "").trim() || null,
    lng: String(formData.get("lng") ?? "").trim() || null,
  })

  await recordEvent("trip_event_added", "driver", `${bookingId} started`)
  revalidatePath(`/drive/${bookingId}`)
}

export async function reachedStopAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const label = String(formData.get("label") ?? "").trim()
  if (!bookingId) return
  await assertOwn(bookingId)

  await addTripEvent({
    bookingId,
    kind: "stop_reached",
    detail: label || null,
    odometerKm: null,
    lat: null,
    lng: null,
  })

  revalidatePath(`/drive/${bookingId}`)
}

export async function completeTripAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  if (!bookingId) return
  await assertOwn(bookingId)

  const odometer = String(formData.get("odometerKm") ?? "").trim()

  await addTripEvent({
    bookingId,
    kind: "completed",
    detail: "Completed by driver",
    odometerKm: odometer === "" ? null : Number(odometer),
    lat: null,
    lng: null,
  })

  await recordEvent("trip_event_added", "driver", `${bookingId} completed`)
  revalidatePath(`/drive/${bookingId}`)
  redirect("/drive")
}

/**
 * An expense the driver paid out of pocket.
 *
 * This is the one number a driver enters that is money, and it is theirs: a
 * toll they paid, which comes back to the operator through settlement. It says
 * nothing about what the trip is worth.
 */
export async function addTripExpenseAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const kind = String(formData.get("kind") ?? "")
  if (!bookingId || !["toll", "parking", "fuel", "state_permit"].includes(kind)) return
  await assertOwn(bookingId)

  let amountPaise: number
  try {
    amountPaise = parseRupeesToPaise(String(formData.get("amount") ?? ""))
  } catch {
    redirect(`/drive/${bookingId}?error=${encodeURIComponent("Enter the amount in rupees")}`)
  }

  if (amountPaise <= 0) redirect(`/drive/${bookingId}`)

  await addExpense({
    bookingId,
    kind: kind as "toll" | "parking" | "fuel" | "state_permit",
    amountPaise,
    receiptUrl: null,
  })

  revalidatePath(`/drive/${bookingId}`)
}

/**
 * SOS.
 *
 * §10 lists safety as the risk that ends the company if handled badly, and
 * requires a real human on the other end 24×7. What this button does today is
 * put an unmissable event on the trip and in the audit log; it does not yet
 * ring anybody's phone, and the screen says so rather than implying help is
 * already coming.
 */
export async function sosAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const detail = String(formData.get("detail") ?? "").trim()
  if (!bookingId) return
  await assertOwn(bookingId)

  await addTripEvent({
    bookingId,
    kind: "sos",
    detail: detail || "SOS raised by driver",
    odometerKm: null,
    lat: null,
    lng: null,
  })

  await recordEvent("trip_event_added", "driver", `SOS on ${bookingId}`)
  revalidatePath(`/drive/${bookingId}`)
}
