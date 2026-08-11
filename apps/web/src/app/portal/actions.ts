"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { createRequest } from "@/data/demand"
import { acceptQuote } from "@/data/fulfilment"
import { customerTrip } from "@/data/scoped"
import { recordEvent } from "@/db/events"
import { fromIstInputValue } from "@/domain/format"
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
