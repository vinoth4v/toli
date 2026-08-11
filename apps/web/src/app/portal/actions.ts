"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { findOffers } from "@/data/availability"
import { createRequest, inviteOperators, quotesForRequest, submitQuote } from "@/data/demand"
import { acceptQuote, assignVehicle } from "@/data/fulfilment"
import { customerTrip } from "@/data/scoped"
import { recordEvent } from "@/db/events"
import { fromIstInputValue } from "@/domain/format"
import { HOME_STATE } from "@/domain/india"
import { TRIP_TYPES } from "@/domain/trip"
import { VEHICLE_CLASSES } from "@/domain/vehicle"

/**
 * What a group organiser may do.
 *
 * Every action re-reads the session and re-checks ownership through the scoped
 * queries. A form field naming a quote is a request, not a permission: the
 * only reason `acceptOwnQuoteAction` accepts a quote id at all is that the
 * lookup behind it is filtered by the signed-in customer.
 */

async function customerId(): Promise<string> {
  const session = await auth()
  const id = session?.user.customerId
  if (!id || session?.user.role !== "customer") redirect("/login")
  return id
}

/**
 * Books a quote the customer has actually been shown.
 *
 * Without the ownership check this is the app's worst hole: any signed-in
 * customer could accept a stranger's quote and commit them to ₹40,000.
 */
export async function acceptOwnQuoteAction(formData: FormData): Promise<void> {
  const quoteId = String(formData.get("quoteId") ?? "")
  const requestId = String(formData.get("requestId") ?? "")
  if (!quoteId || !requestId) return

  const id = await customerId()
  const trip = await customerTrip(id, requestId)
  if (!trip) redirect("/portal")

  const owned = trip.quotes.some((row) => row.quote.id === quoteId)
  if (!owned) redirect("/portal")

  const booking = await acceptQuote(quoteId)
  await recordEvent("quote_accepted", `customer:${id}`, `${booking.reference} via portal`)

  revalidatePath(`/portal/trips/${requestId}`)
  redirect(`/portal/trips/${requestId}`)
}

/**
 * Lane B, in one action: request, quote, booking and assignment together.
 *
 * A customer tapping "book this vehicle" is making one decision, so it becomes
 * one operation — but underneath it produces exactly the same rows a quoted
 * booking does. That is deliberate: settlement, invoicing, compliance and the
 * ops console must not need to know which lane a trip came through, or every
 * one of them grows a second code path.
 *
 * Availability is re-checked here rather than trusted from the form, because
 * between the search and the tap somebody else may have taken the vehicle.
 */
export async function bookInstantAction(formData: FormData): Promise<void> {
  const id = await customerId()

  const vehicleId = String(formData.get("vehicleId") ?? "")
  const startAtRaw = String(formData.get("startAt") ?? "")
  const endAtRaw = String(formData.get("endAt") ?? "")
  const city = String(formData.get("city") ?? "")
  const segment = String(formData.get("segment") ?? "premium") as "economy" | "premium" | "luxury"
  const passengers = Number(formData.get("passengers") ?? "1") || 1
  const estimatedKm = Number(formData.get("km") ?? "0") || 0
  const crossing = String(formData.get("crosses") ?? "")
    .split(",")
    .map((state) => state.trim())
    .filter(Boolean)

  if (!vehicleId || !startAtRaw || !city) redirect("/portal/book")

  const startAt = fromIstInputValue(startAtRaw)
  const endAt = endAtRaw ? fromIstInputValue(endAtRaw) : null
  const days = endAt
    ? Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000))
    : 1

  const offers = await findOffers({
    city,
    segment,
    passengers,
    startAt,
    endAt,
    estimatedKm,
    interstate: false,
    stateCount: 0,
  })

  const offer = offers.find((entry) => entry.vehicleId === vehicleId)
  if (!offer) {
    // Taken, or no longer road-legal for that date. Saying which would be
    // guessing; a fresh search is honest and immediately useful.
    const back = new URLSearchParams({
      error: "That vehicle was taken while you were choosing. Here is what is free now.",
      city,
      segment,
      passengers: String(passengers),
      km: String(estimatedKm),
      startAt: startAtRaw,
      ...(endAtRaw ? { endAt: endAtRaw } : {}),
    })
    redirect(`/portal/book?${back.toString()}`)
  }

  const request = await createRequest({
    customerId: id,
    tripType: endAt ? "round_trip" : "one_way",
    city,
    state: HOME_STATE,
    startAt,
    endAt,
    passengerCount: passengers,
    vehicleClass: offer.vehicleClass as never,
    vehicleCount: 1,
    acRequired: segment !== "economy",
    segment,
    preferredDriverLanguage: String(formData.get("driverLanguage") ?? "").trim() || null,
    features: [],
    extras: [],
    interstate: crossing.length > 0,
    statesCrossed: crossing,
    estimatedKm: estimatedKm || null,
    notes: null,
    stops: [],
  })

  // The quote is the operator's own standing rate, recorded so the booking has
  // the same provenance a hand-typed one would.
  await inviteOperators(request.id, [offer.operatorId], "passenger_transport_5")
  const placed = (await quotesForRequest(request.id))[0]
  if (!placed) redirect("/portal/book")

  await submitQuote(
    placed.id,
    offer.terms,
    {
      tripType: endAt ? "round_trip" : "one_way",
      days,
      nights: Math.max(0, days - 1),
      estimatedKm,
      estimatedHours: Math.max(8, Math.round(estimatedKm / 35)),
      interstate: crossing.length > 0,
      stateCount: crossing.length,
    },
    { validUntil: null, notes: "Instant booking at standing rate", vehicleId: offer.vehicleId },
  )

  const booking = await acceptQuote(placed.id, "instant")

  if (offer.driverId) {
    await assignVehicle({
      bookingId: booking.id,
      vehicleId: offer.vehicleId,
      driverId: offer.driverId,
      subContractedToOperatorId: null,
    })
  }

  await recordEvent("quote_accepted", `customer:${id}`, `${booking.reference} booked instantly`)
  redirect(`/portal/trips/${request.id}`)
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))

const requestSchema = z.object({
  tripType: z.enum(TRIP_TYPES),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  startAt: z.string().min(1),
  endAt: z.string(),
  passengerCount: z.coerce.number().int().min(1).max(500),
  vehicleClass: z.enum(VEHICLE_CLASSES),
  vehicleCount: z.coerce.number().int().min(1).max(20),
  acRequired: z.coerce.boolean(),
  segment: z.enum(["economy", "premium", "luxury"]).default("premium"),
  driverLanguage: optionalText,
  estimatedKm: z.coerce.number().int().min(0).max(20_000),
  statesCrossed: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  extras: z.array(z.string()).default([]),
  notes: optionalText,
  stops: z.array(z.string()),
})

export async function createOwnRequestAction(formData: FormData): Promise<void> {
  const id = await customerId()

  const parsed = requestSchema.safeParse({
    tripType: formData.get("tripType"),
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    startAt: formData.get("startAt") ?? "",
    endAt: formData.get("endAt") ?? "",
    passengerCount: formData.get("passengerCount") ?? "1",
    vehicleClass: formData.get("vehicleClass"),
    vehicleCount: formData.get("vehicleCount") ?? "1",
    acRequired: formData.get("acRequired") === "on",
    segment: formData.get("segment") ?? "premium",
    driverLanguage: formData.get("driverLanguage") ?? "",
    estimatedKm: formData.get("estimatedKm") || "0",
    statesCrossed: formData.getAll("statesCrossed").map(String),
    features: formData.getAll("features").map(String),
    extras: formData.getAll("extras").map(String),
    notes: formData.get("notes") ?? "",
    stops: formData
      .getAll("stops")
      .map(String)
      .map((value) => value.trim())
      .filter((value) => value !== ""),
  })

  if (!parsed.success) {
    redirect(`/portal/new?error=${encodeURIComponent("Please check the trip details")}`)
  }

  const input = parsed.data
  const request = await createRequest({
    customerId: id,
    tripType: input.tripType,
    city: input.city,
    state: input.state,
    startAt: fromIstInputValue(input.startAt),
    endAt: input.endAt ? fromIstInputValue(input.endAt) : null,
    passengerCount: input.passengerCount,
    vehicleClass: input.vehicleClass,
    vehicleCount: input.vehicleCount,
    acRequired: input.acRequired,
    segment: input.segment,
    preferredDriverLanguage: input.driverLanguage,
    features: input.features,
    extras: input.extras,
    interstate: input.statesCrossed.length > 0,
    statesCrossed: input.statesCrossed,
    estimatedKm: input.estimatedKm || null,
    notes: input.notes,
    stops: input.stops.map((label) => ({ label, haltMinutes: null })),
  })

  await recordEvent("request_created", `customer:${id}`, `${request.reference} via portal`)
  redirect(`/portal/trips/${request.id}`)
}
