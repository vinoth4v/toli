"use server"

import { and, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import { bookings, charterRequests, operators, quotes } from "@/db/schema"
import { isSegment, isVehicleKind } from "@/lib/catalog"
import { checkboxField, dateField, intField, optionalField, rupeeField, textField } from "@/lib/form"
import { priceQuote, settlement, splitAdvance, tripDuration } from "@/lib/pricing"

/** Lane A, in three actions: post a requirement, record what came back, award one. */

export async function createRequestAction(form: FormData): Promise<void> {
  const customerName = textField(form, "customerName")
  const customerPhone = textField(form, "customerPhone")
  const segment = textField(form, "segment")
  const fromCity = textField(form, "fromCity")
  const itinerary = textField(form, "itinerary")
  const startDate = dateField(form, "startDate")
  const endDate = dateField(form, "endDate")
  const passengers = intField(form, "passengers")
  const vehicleKind = textField(form, "vehicleKind")
  const vehiclesNeeded = intField(form, "vehiclesNeeded")
  const estimatedKm = intField(form, "estimatedKm")

  // One guard per field rather than one combined condition: each `redirect`
  // returns `never`, so this is also what narrows the nullable reads below.
  const invalid = "/requests/new?error=invalid"
  if (!customerName || !customerPhone || !fromCity || !itinerary) redirect(invalid)
  if (!isSegment(segment) || !isVehicleKind(vehicleKind)) redirect(invalid)
  if (!startDate || !endDate || endDate < startDate) redirect(invalid)
  if (passengers === null || passengers < 1) redirect(invalid)
  if (vehiclesNeeded === null || vehiclesNeeded < 1) redirect(invalid)
  if (estimatedKm === null) redirect(invalid)

  const [created] = await db()
    .insert(charterRequests)
    .values({
      customerName,
      customerPhone,
      customerEmail: optionalField(form, "customerEmail"),
      segment,
      fromCity,
      itinerary,
      startDate,
      endDate,
      passengers,
      vehicleKind,
      vehiclesNeeded,
      estimatedKm,
      notes: optionalField(form, "notes"),
    })
    .returning({ id: charterRequests.id, reference: charterRequests.reference })

  if (!created) redirect("/requests?error=invalid")

  await recordEvent("request_created", customerName, `#${created.reference} from ${fromCity}`)
  redirect(`/requests/${created.id}`)
}

/**
 * Record what an operator quoted.
 *
 * Typed in by the desk, from a phone call or a WhatsApp message — this is
 * *assisted* RFQ, and no operator signs in. The structure is the product:
 * whatever they said, it lands here as the same seven components, which is
 * the only reason two quotes can be compared at all.
 */
export async function recordQuoteAction(form: FormData): Promise<void> {
  const requestId = textField(form, "requestId")
  const operatorId = textField(form, "operatorId")
  const vehicleKind = textField(form, "vehicleKind")
  const seats = intField(form, "seats")
  const includedKm = intField(form, "includedKm")
  const baseFarePaise = rupeeField(form, "baseFare")
  const perKmPaise = rupeeField(form, "perKm")
  const driverBataPaise = rupeeField(form, "driverBata")
  const nightHaltPaise = rupeeField(form, "nightHalt")
  const tollsPaise = rupeeField(form, "tolls")
  const parkingPaise = rupeeField(form, "parking")
  const permitPaise = rupeeField(form, "permit")

  if (!requestId) redirect("/requests?error=invalid")

  const amounts = [
    baseFarePaise,
    perKmPaise,
    driverBataPaise,
    nightHaltPaise,
    tollsPaise,
    parkingPaise,
    permitPaise,
  ]

  if (
    !operatorId ||
    !isVehicleKind(vehicleKind) ||
    seats === null ||
    seats < 1 ||
    includedKm === null ||
    amounts.some((amount) => amount === null)
  ) {
    redirect(`/requests/${requestId}?error=quote`)
  }

  // The `?? 0` fallbacks are unreachable — the guard above rejects a null
  // amount — but `.some()` cannot narrow the individual reads for TypeScript.
  await db()
    .insert(quotes)
    .values({
      requestId,
      operatorId,
      vehicleKind,
      seats,
      includedKm,
      baseFarePaise: baseFarePaise ?? 0,
      perKmPaise: perKmPaise ?? 0,
      driverBataPaise: driverBataPaise ?? 0,
      nightHaltPaise: nightHaltPaise ?? 0,
      tollsPaise: tollsPaise ?? 0,
      parkingPaise: parkingPaise ?? 0,
      permitPaise: permitPaise ?? 0,
      tollsIncluded: checkboxField(form, "tollsIncluded"),
      parkingIncluded: checkboxField(form, "parkingIncluded"),
      permitIncluded: checkboxField(form, "permitIncluded"),
      notes: optionalField(form, "notes"),
    })

  await recordEvent("quote_recorded", operatorId, `request ${requestId}`)
  revalidatePath(`/requests/${requestId}`)
}

/**
 * Award a quote and freeze the numbers.
 *
 * Four writes, and the neon-http driver has no transaction across them, so
 * the order is the safety: the booking row goes in first, and its unique
 * index on request_id is what makes a double award impossible even if the
 * operator double-clicks. Everything after it is a status the desk can see
 * and correct; a booking that exists twice is not.
 */
export async function awardQuoteAction(form: FormData): Promise<void> {
  const requestId = textField(form, "requestId")
  const quoteId = textField(form, "quoteId")
  if (!requestId || !quoteId) redirect("/requests?error=invalid")

  const [request] = await db()
    .select()
    .from(charterRequests)
    .where(eq(charterRequests.id, requestId))
    .limit(1)
  const [quote] = await db().select().from(quotes).where(eq(quotes.id, quoteId)).limit(1)
  if (!request || !quote) redirect(`/requests/${requestId}?error=award`)

  // Awarding twice is refused here so the operator sees a message rather than
  // a crash. The unique index on booking.request_id is still what makes it
  // impossible — this check only makes the failure legible.
  if (request.status !== "open") redirect(`/requests/${requestId}?error=award`)

  const [operator] = await db()
    .select()
    .from(operators)
    .where(eq(operators.id, quote.operatorId))
    .limit(1)
  if (!operator) redirect(`/requests/${requestId}?error=award`)

  const { days, nights } = tripDuration(request.startDate, request.endDate)
  const priced = priceQuote(
    { days, nights, estimatedKm: request.estimatedKm, passengers: request.passengers },
    quote,
  )
  const { advancePaise } = splitAdvance(priced.allInPaise)
  const { commissionPaise } = settlement(priced.allInPaise, operator.commissionBps)

  await db().insert(bookings).values({
    requestId,
    quoteId,
    operatorId: quote.operatorId,
    allInPaise: priced.allInPaise,
    advancePaise,
    commissionPaise,
  })

  await db().update(quotes).set({ status: "awarded" }).where(eq(quotes.id, quoteId))
  await db()
    .update(quotes)
    .set({ status: "declined" })
    .where(and(eq(quotes.requestId, requestId), ne(quotes.id, quoteId)))
  await db()
    .update(charterRequests)
    .set({ status: "awarded" })
    .where(eq(charterRequests.id, requestId))

  await recordEvent(
    "quote_awarded",
    operator.name,
    `request #${request.reference}, ${priced.allInPaise} paise all-in`,
  )

  revalidatePath(`/requests/${requestId}`)
  revalidatePath("/bookings")
  revalidatePath("/")
}

export async function cancelRequestAction(form: FormData): Promise<void> {
  const requestId = textField(form, "requestId")
  if (!requestId) redirect("/requests?error=invalid")

  // Only an open requirement can be cancelled: an awarded one has a booking
  // against it, and cancelling that is a conversation with an operator, not a
  // status flip.
  await db()
    .update(charterRequests)
    .set({ status: "cancelled" })
    .where(and(eq(charterRequests.id, requestId), eq(charterRequests.status, "open")))
  await recordEvent("request_cancelled", requestId)

  revalidatePath(`/requests/${requestId}`)
  revalidatePath("/")
}

export async function setBookingStatusAction(form: FormData): Promise<void> {
  const bookingId = textField(form, "bookingId")
  const status = textField(form, "status")
  if (!bookingId || !["confirmed", "completed", "cancelled"].includes(status)) {
    redirect("/bookings?error=invalid")
  }

  await db().update(bookings).set({ status }).where(eq(bookings.id, bookingId))
  await recordEvent("booking_updated", bookingId, status)

  revalidatePath("/bookings")
  revalidatePath("/")
}
