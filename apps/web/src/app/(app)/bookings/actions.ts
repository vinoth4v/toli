"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { getBooking, recordPayment, updateBooking } from "@/db/bookings"
import { recordEvent } from "@/db/events"
import { formatInr, rupeesToPaise } from "@/domain/money"
import {
  BOOKING_STATUSES,
  canTransitionBooking,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
} from "@/domain/status"

async function actor(): Promise<string | null> {
  const session = await auth()
  return session?.user?.email ?? null
}

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That did not look right"
}

const trimmed = z.string().trim()

const assignmentSchema = z.object({
  bookingId: z.uuid(),
  driverName: trimmed,
  driverPhone: z.union([
    trimmed.regex(/^[0-9+\s-]{10,15}$/, "That is not a phone number"),
    z.literal(""),
  ]),
  vehicleRegistration: trimmed,
  pickupNote: trimmed,
})

/**
 * Record who is actually driving.
 *
 * Filled in a day or two before departure, not at booking: the operator does
 * not know which of their drivers is free three weeks out, and forcing a name
 * at confirmation just gets a placeholder that nobody corrects.
 */
export async function assignDriverAction(formData: FormData): Promise<void> {
  const parsed = assignmentSchema.safeParse({
    bookingId: formData.get("bookingId"),
    driverName: formData.get("driverName") ?? "",
    driverPhone: formData.get("driverPhone") ?? "",
    vehicleRegistration: formData.get("vehicleRegistration") ?? "",
    pickupNote: formData.get("pickupNote") ?? "",
  })

  if (!parsed.success) {
    redirect(`/bookings?error=${encodeURIComponent(firstMessage(parsed.error))}`)
  }

  await updateBooking(parsed.data.bookingId, {
    driverName: parsed.data.driverName || null,
    driverPhone: parsed.data.driverPhone || null,
    vehicleRegistration: parsed.data.vehicleRegistration || null,
    pickupNote: parsed.data.pickupNote || null,
  })

  await recordEvent("booking_updated", await actor(), `driver set on ${parsed.data.bookingId}`)
  revalidatePath(`/bookings/${parsed.data.bookingId}`)
}

const statusSchema = z.object({
  bookingId: z.uuid(),
  status: z.enum(BOOKING_STATUSES),
  reason: trimmed,
})

/**
 * Move a booking along.
 *
 * The transition is checked against the current status rather than trusted
 * from the form: a stale tab showing "confirmed" for a trip that already
 * finished must not be able to send it backwards.
 */
export async function setBookingStatusAction(formData: FormData): Promise<void> {
  const parsed = statusSchema.safeParse({
    bookingId: formData.get("bookingId"),
    status: formData.get("status"),
    reason: formData.get("reason") ?? "",
  })
  if (!parsed.success) return

  const found = await getBooking(parsed.data.bookingId)
  if (!found) {
    redirect("/bookings?error=That+booking+is+gone")
  }

  if (!canTransitionBooking(found.booking.status, parsed.data.status)) {
    redirect(
      `/bookings/${parsed.data.bookingId}?error=${encodeURIComponent(
        `A ${found.booking.status} booking cannot become ${parsed.data.status}`,
      )}`,
    )
  }

  await updateBooking(parsed.data.bookingId, {
    status: parsed.data.status,
    completedAt: parsed.data.status === "completed" ? new Date() : null,
    cancellationReason: parsed.data.status === "cancelled" ? parsed.data.reason || null : null,
  })

  await recordEvent(
    "booking_status_changed",
    await actor(),
    `${found.booking.ref} ${found.booking.status} -> ${parsed.data.status}`,
  )

  revalidatePath(`/bookings/${parsed.data.bookingId}`)
  revalidatePath("/bookings")
  revalidatePath("/")
}

const paymentSchema = z.object({
  bookingId: z.uuid(),
  kind: z.enum(PAYMENT_KINDS),
  method: z.enum(PAYMENT_METHODS),
  amountRupees: z.coerce.number().gt(0, "How much moved?").max(10_000_000),
  reference: trimmed,
  note: trimmed,
})

export async function recordPaymentAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const parsed = paymentSchema.safeParse({
    bookingId,
    kind: formData.get("kind"),
    method: formData.get("method"),
    amountRupees: formData.get("amountRupees") ?? "0",
    reference: formData.get("reference") ?? "",
    note: formData.get("note") ?? "",
  })

  if (!parsed.success) {
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent(firstMessage(parsed.error))}`)
  }

  const amountPaise = rupeesToPaise(parsed.data.amountRupees)

  await recordPayment({
    bookingId: parsed.data.bookingId,
    kind: parsed.data.kind,
    method: parsed.data.method,
    amountPaise,
    reference: parsed.data.reference || null,
    note: parsed.data.note || null,
  })

  await recordEvent(
    "payment_recorded",
    await actor(),
    `${parsed.data.kind} ${formatInr(amountPaise)} on ${parsed.data.bookingId}`,
  )

  revalidatePath(`/bookings/${parsed.data.bookingId}`)
  revalidatePath("/")
}
