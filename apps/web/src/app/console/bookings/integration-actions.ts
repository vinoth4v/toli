"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getBooking } from "@/data/fulfilment"
import { queueAndSend } from "@/data/notifications"
import { recordPendingLink } from "@/data/payments"
import { recordEvent } from "@/db/events"
import { NotConfiguredError } from "@/integrations/config"
import { createPaymentLink } from "@/integrations/razorpay"
import { compose } from "@/integrations/whatsapp"

/**
 * The actions that reach an external system, kept apart from the ones that
 * only touch this database.
 *
 * Every one of them can fail for a reason that is nobody's mistake — a
 * provider is down, or was never configured. So each catches
 * `NotConfiguredError` and returns the missing variable names as a sentence on
 * the page, rather than a stack trace, and never leaves the booking in a state
 * that implies something happened when it did not.
 */

async function actor(): Promise<string | null> {
  const session = await auth()
  return session?.user?.email ?? null
}

function problem(bookingId: string, error: unknown): never {
  const message =
    error instanceof NotConfiguredError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Something went wrong reaching the provider"

  redirect(`/console/bookings/${bookingId}?error=${encodeURIComponent(message)}`)
}

/**
 * Sends the customer a payment link for what they still owe.
 *
 * §8.1: UPI intent is 70%+ of transactions, and the shortest path from "yes"
 * on a phone call to money received is a link that opens GPay. The amount is
 * whatever is outstanding, not a number typed twice.
 */
export async function sendPaymentLinkAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const kind = String(formData.get("kind") ?? "advance") === "balance" ? "balance" : "advance"
  if (!bookingId) return

  const detail = await getBooking(bookingId)
  if (!detail) return

  const captured = detail.payments
    .filter((payment) => payment.status === "captured" && payment.kind !== "refund")
    .reduce((total, payment) => total + payment.amountPaise, 0)

  const amountPaise =
    kind === "advance"
      ? Math.max(0, detail.booking.advanceDuePaise - captured)
      : Math.max(0, detail.booking.agreedTotalPaise - captured)

  if (amountPaise <= 0) {
    redirect(`/console/bookings/${bookingId}?error=${encodeURIComponent("Nothing is outstanding")}`)
  }

  try {
    const link = await createPaymentLink({
      amountPaise,
      description: `Toli booking ${detail.booking.reference}`,
      reference: detail.booking.reference,
      customer: {
        name: detail.customer.name,
        phoneE164: detail.customer.phone.replace(/\D/g, "").slice(-10).padStart(12, "91"),
        email: detail.customer.email,
      },
      notes: { booking_reference: detail.booking.reference },
    })

    await recordPendingLink({
      bookingId,
      kind,
      amountPaise,
      providerLinkId: link.id,
      providerLinkUrl: link.shortUrl,
    })

    // The link is worth nothing sitting in this database — it has to reach the
    // customer, and §4.5 says that means WhatsApp.
    await queueAndSend(
      compose.paymentReminder({
        customerPhone: detail.customer.phone,
        reference: detail.booking.reference,
        amountPaise,
        payUrl: link.shortUrl,
        departAt: detail.request.startAt,
      }),
      bookingId,
    )

    await recordEvent("payment_recorded", await actor(), `link ${link.id} for ${amountPaise} paise`)
  } catch (error) {
    problem(bookingId, error)
  }

  revalidatePath(`/console/bookings/${bookingId}`)
}

/** §4.1 releases vehicle and driver details at T-12h. This is that message. */
export async function sendDriverDetailsAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  if (!bookingId) return

  const detail = await getBooking(bookingId)
  if (!detail) return

  if (!detail.assignment) {
    redirect(
      `/bookings/${bookingId}?error=${encodeURIComponent("Assign a vehicle and driver first")}`,
    )
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://toli-flame.vercel.app"

  try {
    const result = await queueAndSend(
      compose.driverDetails({
        customerPhone: detail.customer.phone,
        reference: detail.booking.reference,
        driverName: detail.assignment.driver.name,
        driverPhone: detail.assignment.driver.phone,
        vehicleRegistration: detail.assignment.vehicle.registrationNumber,
        trackingUrl: `${origin}/track/${detail.booking.trackingToken}`,
      }),
      bookingId,
    )

    await recordEvent("trip_event_added", await actor(), `driver details ${result.status}`)
  } catch (error) {
    problem(bookingId, error)
  }

  revalidatePath(`/console/bookings/${bookingId}`)
}

export async function sendBookingConfirmationAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  if (!bookingId) return

  const detail = await getBooking(bookingId)
  if (!detail) return

  try {
    await queueAndSend(
      compose.bookingConfirmed({
        customerPhone: detail.customer.phone,
        customerName: detail.customer.name,
        reference: detail.booking.reference,
        vehicleDescription: `${detail.request.vehicleCount} × ${detail.request.passengerCount}-seat class`,
        departAt: detail.request.startAt,
        totalPaise: detail.booking.agreedTotalPaise,
      }),
      bookingId,
    )
  } catch (error) {
    problem(bookingId, error)
  }

  revalidatePath(`/console/bookings/${bookingId}`)
}

export async function sendTrackingLinkAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const toPhone = String(formData.get("toPhone") ?? "").trim()
  if (!bookingId || !toPhone) return

  const detail = await getBooking(bookingId)
  if (!detail) return

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://toli-flame.vercel.app"

  try {
    await queueAndSend(
      compose.trackingLink({
        toPhone,
        reference: detail.booking.reference,
        trackingUrl: `${origin}/track/${detail.booking.trackingToken}`,
      }),
      bookingId,
    )
  } catch (error) {
    problem(bookingId, error)
  }

  revalidatePath(`/console/bookings/${bookingId}`)
}
