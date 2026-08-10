"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { createBooking } from "@/db/bookings"
import { createEnquiry, getEnquiry, setEnquiryStatus } from "@/db/enquiries"
import { recordEvent } from "@/db/events"
import { listQuotableVehicles } from "@/db/operators"
import { createQuote, declineOtherQuotes, getQuote, setQuoteStatus } from "@/db/quotes"
import type { BookingRow } from "@/db/schema"
import { parseIstLocal } from "@/domain/datetime"
import { formatInr, rupeesToPaise } from "@/domain/money"
import { computeQuote, TRIP_TYPES } from "@/domain/pricing"
import { newRef } from "@/domain/reference"
import { VEHICLE_CLASSES } from "@/domain/vehicles"

async function actor(): Promise<string | null> {
  const session = await auth()
  return session?.user?.email ?? null
}

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That did not look right"
}

const trimmed = z.string().trim()

const enquirySchema = z.object({
  customerName: trimmed.min(2, "Who is asking?"),
  customerPhone: trimmed.regex(/^[0-9+\s-]{10,15}$/, "That is not a phone number"),
  customerEmail: z.union([z.email("That is not an email address"), z.literal("")]),
  origin: trimmed.min(2, "Where does the trip start?"),
  destination: trimmed.min(2, "Where is the group going?"),
  tripType: z.enum(TRIP_TYPES),
  startAt: trimmed.min(1, "When does it leave?"),
  days: z.coerce.number().int().min(1, "A trip lasts at least a day").max(60),
  passengers: z.coerce.number().int().min(1, "How many are travelling?").max(200),
  estimatedKm: z.coerce.number().int().min(1, "Roughly how far?").max(20_000),
  vehicleClass: z.enum(VEHICLE_CLASSES),
  notes: trimmed,
})

export async function createEnquiryAction(formData: FormData): Promise<void> {
  const parsed = enquirySchema.safeParse({
    customerName: formData.get("customerName") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    customerEmail: formData.get("customerEmail") ?? "",
    origin: formData.get("origin") ?? "",
    destination: formData.get("destination") ?? "",
    tripType: formData.get("tripType"),
    startAt: formData.get("startAt") ?? "",
    days: formData.get("days") ?? "1",
    passengers: formData.get("passengers") ?? "0",
    estimatedKm: formData.get("estimatedKm") ?? "0",
    vehicleClass: formData.get("vehicleClass"),
    notes: formData.get("notes") ?? "",
  })

  if (!parsed.success) {
    redirect(`/enquiries/new?error=${encodeURIComponent(firstMessage(parsed.error))}`)
  }

  const startAt = parseIstLocal(parsed.data.startAt)
  if (!startAt) {
    redirect("/enquiries/new?error=That+departure+time+did+not+make+sense")
  }

  const row = await createEnquiry({
    ref: newRef("TL"),
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    customerEmail: parsed.data.customerEmail || null,
    origin: parsed.data.origin,
    destination: parsed.data.destination,
    tripType: parsed.data.tripType,
    startAt,
    days: parsed.data.days,
    passengers: parsed.data.passengers,
    estimatedKm: parsed.data.estimatedKm,
    vehicleClass: parsed.data.vehicleClass,
    notes: parsed.data.notes || null,
  })

  await recordEvent(
    "enquiry_created",
    await actor(),
    `${row?.ref ?? "?"}: ${parsed.data.origin} to ${parsed.data.destination}`,
  )
  revalidatePath("/enquiries")
  revalidatePath("/")

  redirect(row ? `/enquiries/${row.id}` : "/enquiries")
}

const quoteSchema = z.object({
  enquiryId: z.uuid(),
  vehicleId: z.uuid("Choose a vehicle"),
  tollsParkingRupees: z.coerce.number().min(0).max(500_000),
  // The two regimes as strings, mapped below: a plain number would type as
  // `number` and lose the guarantee that only 5% or 12% can reach the engine.
  gstRateBps: z.enum(["500", "1200"]),
  validDays: z.coerce.number().int().min(1).max(30),
})

/**
 * Price one operator's vehicle against one enquiry.
 *
 * The fare is computed here and then stored in full. Nothing recomputes it
 * afterwards: the rate card can move tomorrow, and a quote already given has
 * to stay explainable line by line.
 */
export async function createQuoteAction(formData: FormData): Promise<void> {
  const enquiryId = String(formData.get("enquiryId") ?? "")
  const parsed = quoteSchema.safeParse({
    enquiryId,
    vehicleId: formData.get("vehicleId"),
    tollsParkingRupees: formData.get("tollsParkingRupees") ?? "0",
    gstRateBps: formData.get("gstRateBps") ?? "500",
    validDays: formData.get("validDays") ?? "7",
  })

  if (!parsed.success) {
    redirect(`/enquiries/${enquiryId}?error=${encodeURIComponent(firstMessage(parsed.error))}`)
  }

  const enquiry = await getEnquiry(parsed.data.enquiryId)
  if (!enquiry) {
    redirect("/enquiries?error=That+enquiry+is+gone")
  }

  // Re-read the vehicle from the quotable list rather than trusting the form:
  // it carries the operator, the rate, and the proof they are still verified.
  const choice = (await listQuotableVehicles()).find(
    (row) => row.vehicle.id === parsed.data.vehicleId,
  )
  if (!choice) {
    redirect(`/enquiries/${enquiryId}?error=That+vehicle+cannot+be+quoted+right+now`)
  }

  const breakdown = computeQuote({
    vehicleClass: choice.vehicle.class,
    tripType: enquiry.tripType,
    estimatedKm: enquiry.estimatedKm,
    days: enquiry.days,
    perKmPaiseOverride: choice.vehicle.perKmPaise,
    tollsParkingPaise: rupeesToPaise(parsed.data.tollsParkingRupees),
    gstRateBps: parsed.data.gstRateBps === "500" ? 500 : 1200,
    commissionBps: choice.operator.commissionBps,
  })

  const validUntil = new Date(Date.now() + parsed.data.validDays * 86_400_000)

  await createQuote({
    enquiryId: enquiry.id,
    operatorId: choice.operator.id,
    vehicleId: choice.vehicle.id,
    perKmPaise: breakdown.perKmPaise,
    chargeableKm: breakdown.chargeableKm,
    baseFarePaise: breakdown.baseFarePaise,
    driverAllowancePaise: breakdown.driverAllowancePaise,
    nightHaltPaise: breakdown.nightHaltPaise,
    tollsParkingPaise: breakdown.tollsParkingPaise,
    subtotalPaise: breakdown.subtotalPaise,
    gstRateBps: breakdown.gstRateBps,
    gstPaise: breakdown.gstPaise,
    totalPaise: breakdown.totalPaise,
    commissionBps: breakdown.commissionBps,
    commissionPaise: breakdown.commissionPaise,
    operatorPayoutPaise: breakdown.operatorPayoutPaise,
    validUntil,
  })

  await recordEvent(
    "quote_created",
    await actor(),
    `${enquiry.ref}: ${choice.operator.name} at ${formatInr(breakdown.totalPaise)}`,
  )
  revalidatePath(`/enquiries/${enquiry.id}`)
}

const quoteActionSchema = z.object({
  quoteId: z.uuid(),
  enquiryId: z.uuid(),
})

export async function sendQuoteAction(formData: FormData): Promise<void> {
  const parsed = quoteActionSchema.safeParse({
    quoteId: formData.get("quoteId"),
    enquiryId: formData.get("enquiryId"),
  })
  if (!parsed.success) return

  await setQuoteStatus(parsed.data.quoteId, "sent")
  await setEnquiryStatus(parsed.data.enquiryId, "quoted")
  await recordEvent("quote_sent", await actor(), parsed.data.quoteId)

  revalidatePath(`/enquiries/${parsed.data.enquiryId}`)
  revalidatePath("/enquiries")
  revalidatePath("/")
}

export async function declineQuoteAction(formData: FormData): Promise<void> {
  const parsed = quoteActionSchema.safeParse({
    quoteId: formData.get("quoteId"),
    enquiryId: formData.get("enquiryId"),
  })
  if (!parsed.success) return

  await setQuoteStatus(parsed.data.quoteId, "declined")
  await recordEvent("quote_declined", await actor(), parsed.data.quoteId)

  revalidatePath(`/enquiries/${parsed.data.enquiryId}`)
}

/**
 * Accept a quote, which is the moment an enquiry becomes a trip.
 *
 * Four writes, in the order that fails safely. The booking goes first: it
 * carries the unique index on the quote, so a double-clicked "accept" is
 * refused by the database rather than confirming the same vehicle twice. If a
 * later write fails the booking still exists and is visible — the alternative,
 * writing it last, loses the customer's confirmation entirely. The neon-http
 * driver has no interactive transactions, which is why the order is the
 * safeguard rather than a rollback.
 */
export async function acceptQuoteAction(formData: FormData): Promise<void> {
  const parsed = quoteActionSchema.safeParse({
    quoteId: formData.get("quoteId"),
    enquiryId: formData.get("enquiryId"),
  })
  if (!parsed.success) return

  const found = await getQuote(parsed.data.quoteId)
  if (!found) {
    redirect(`/enquiries/${parsed.data.enquiryId}?error=That+quote+is+gone`)
  }

  const booking = await bookQuote(
    found.quote.id,
    found.quote.enquiryId,
    found.vehicle?.registration,
  )

  if (!booking) {
    redirect(`/enquiries/${parsed.data.enquiryId}?error=That+quote+is+already+booked`)
  }

  await setQuoteStatus(found.quote.id, "accepted")
  await declineOtherQuotes(found.quote.enquiryId, found.quote.id)
  await setEnquiryStatus(found.quote.enquiryId, "won")

  await recordEvent(
    "quote_accepted",
    await actor(),
    `${booking.ref}: ${found.operator.name} at ${formatInr(found.quote.totalPaise)}`,
  )

  revalidatePath("/")
  revalidatePath("/enquiries")
  revalidatePath("/bookings")

  redirect(`/bookings/${booking.id}`)
}

/**
 * Create the booking, or return null if this quote already has one.
 *
 * The unique index on `quote_id` is what refuses the second accept, so the
 * duplicate arrives here as a thrown error. It is caught in its own function
 * rather than inline because `redirect` signals by throwing, and a try block
 * wrapped around the action's flow would swallow the redirect instead of
 * performing it.
 */
async function bookQuote(
  quoteId: string,
  enquiryId: string,
  registration: string | null | undefined,
): Promise<BookingRow | null> {
  try {
    const row = await createBooking({
      ref: newRef("BK"),
      quoteId,
      enquiryId,
      vehicleRegistration: registration ?? null,
    })
    return row ?? null
  } catch (error) {
    console.error("booking insert failed", error)
    return null
  }
}

const loseSchema = z.object({ enquiryId: z.uuid() })

export async function markEnquiryLostAction(formData: FormData): Promise<void> {
  const parsed = loseSchema.safeParse({ enquiryId: formData.get("enquiryId") })
  if (!parsed.success) return

  await setEnquiryStatus(parsed.data.enquiryId, "lost")
  revalidatePath(`/enquiries/${parsed.data.enquiryId}`)
  revalidatePath("/enquiries")
  revalidatePath("/")
}
