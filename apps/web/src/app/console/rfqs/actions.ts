"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import {
  createRequest,
  findOrCreateCustomer,
  getQuote,
  inviteOperators,
  shapeOf,
  submitQuote,
} from "@/data/demand"
import { acceptQuote } from "@/data/fulfilment"
import { getSettings } from "@/data/settings"
import { recordEvent } from "@/db/events"
import { fromIstInputValue } from "@/domain/format"
import { parseRupeesToPaise } from "@/domain/money"
import { type QuoteTerms, validateQuoteTerms } from "@/domain/quote"
import { TRIP_TYPES } from "@/domain/trip"
import { VEHICLE_CLASSES } from "@/domain/vehicle"

/**
 * Everything the RFQ desk does.
 *
 * Each action validates with zod before it touches the database, and returns
 * its error as a redirect parameter rather than throwing: an ops person who
 * mistyped a rate should get the form back with a sentence, not a stack trace
 * on a white page at 11 PM.
 */

async function actor(): Promise<string | null> {
  const session = await auth()
  return session?.user?.email ?? null
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))

const requestSchema = z.object({
  customerName: z.string().trim().min(1),
  customerPhone: z.string().trim().min(6),
  customerEmail: optionalText,
  customerGstin: optionalText,
  segment: optionalText,
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

export async function createRequestAction(formData: FormData): Promise<void> {
  const parsed = requestSchema.safeParse({
    customerName: formData.get("customerName") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    customerEmail: formData.get("customerEmail") ?? "",
    customerGstin: formData.get("customerGstin") ?? "",
    segment: formData.get("segment") ?? "",
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
    redirect(`/console/rfqs/new?error=${encodeURIComponent(problemsOf(parsed.error))}`)
  }

  const input = parsed.data
  const customer = await findOrCreateCustomer({
    name: input.customerName,
    phone: input.customerPhone,
    email: input.customerEmail,
    gstin: input.customerGstin,
    city: input.city,
    segment: input.segment,
  })

  const request = await createRequest({
    customerId: customer.id,
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
    // Crossing a state line is what makes an AITP mandatory, so it is derived
    // from the states named rather than left as a checkbox someone forgets.
    interstate: input.statesCrossed.length > 0,
    statesCrossed: input.statesCrossed,
    estimatedKm: input.estimatedKm || null,
    notes: input.notes,
    stops: input.stops.map((label) => ({ label, haltMinutes: null })),
  })

  await recordEvent("request_created", await actor(), `${request.reference} for ${customer.name}`)
  redirect(`/console/rfqs/${request.id}`)
}

export async function inviteOperatorsAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "")
  const operatorIds = formData.getAll("operatorIds").map(String)
  if (!requestId) return

  const settings = await getSettings()
  const invited = await inviteOperators(requestId, operatorIds, settings.defaultGstTreatment)

  await recordEvent("operators_invited", await actor(), `${invited} operator(s) on ${requestId}`)
  revalidatePath(`/console/rfqs/${requestId}`)
}

const quoteSchema = z.object({
  quoteId: z.string().uuid(),
  baseFare: z.string(),
  includedKm: z.string(),
  includedHours: z.string(),
  extraKmRate: z.string(),
  extraHourRate: z.string(),
  perKmRate: z.string(),
  minKmPerDay: z.string(),
  driverBata: z.string(),
  nightHalt: z.string(),
  tollIncluded: z.coerce.boolean(),
  parkingIncluded: z.coerce.boolean(),
  statePermitIncluded: z.coerce.boolean(),
  fuelIncluded: z.coerce.boolean(),
  vehicleId: optionalText,
  notes: optionalText,
})

function optionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === "") return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

export async function submitQuoteAction(formData: FormData): Promise<void> {
  const parsed = quoteSchema.safeParse({
    quoteId: formData.get("quoteId"),
    baseFare: formData.get("baseFare") ?? "",
    includedKm: formData.get("includedKm") ?? "",
    includedHours: formData.get("includedHours") ?? "",
    extraKmRate: formData.get("extraKmRate") ?? "",
    extraHourRate: formData.get("extraHourRate") ?? "",
    perKmRate: formData.get("perKmRate") ?? "",
    minKmPerDay: formData.get("minKmPerDay") ?? "",
    driverBata: formData.get("driverBata") ?? "",
    nightHalt: formData.get("nightHalt") ?? "",
    tollIncluded: formData.get("tollIncluded") === "on",
    parkingIncluded: formData.get("parkingIncluded") === "on",
    statePermitIncluded: formData.get("statePermitIncluded") === "on",
    fuelIncluded: formData.get("fuelIncluded") === "on",
    vehicleId: formData.get("vehicleId") ?? "",
    notes: formData.get("notes") ?? "",
  })

  if (!parsed.success) return

  const found = await getQuote(parsed.data.quoteId)
  if (!found) return

  let terms: QuoteTerms
  try {
    terms = {
      baseFarePaise: parseRupeesToPaise(parsed.data.baseFare),
      includedKm: optionalInt(parsed.data.includedKm),
      includedHours: optionalInt(parsed.data.includedHours),
      extraKmRatePaise: parsed.data.extraKmRate.trim()
        ? parseRupeesToPaise(parsed.data.extraKmRate)
        : null,
      extraHourRatePaise: parsed.data.extraHourRate.trim()
        ? parseRupeesToPaise(parsed.data.extraHourRate)
        : null,
      perKmRatePaise: parsed.data.perKmRate.trim()
        ? parseRupeesToPaise(parsed.data.perKmRate)
        : null,
      minKmPerDay: optionalInt(parsed.data.minKmPerDay),
      driverBataPerDayPaise: parseRupeesToPaise(parsed.data.driverBata),
      nightHaltPaise: parseRupeesToPaise(parsed.data.nightHalt),
      tollIncluded: parsed.data.tollIncluded,
      parkingIncluded: parsed.data.parkingIncluded,
      statePermitIncluded: parsed.data.statePermitIncluded,
      fuelIncluded: parsed.data.fuelIncluded,
      gstTreatment: found.quote.gstTreatment,
    }
  } catch (error) {
    redirect(
      `/rfqs/${found.request.id}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Amounts must be in rupees",
      )}`,
    )
  }

  const shape = shapeOf(found.request)

  // The mandatory-field rule of §7.1, enforced where it bites: a quote missing
  // its minimum km per day is refused rather than stored as a comparable one.
  const problems = validateQuoteTerms(terms, shape)
  if (problems.length > 0) {
    redirect(`/console/rfqs/${found.request.id}?error=${encodeURIComponent(problems.join(" "))}`)
  }

  const settings = await getSettings()
  await submitQuote(parsed.data.quoteId, terms, shape, {
    validUntil: new Date(Date.now() + settings.quoteValidityHours * 3_600_000),
    notes: parsed.data.notes,
    vehicleId: parsed.data.vehicleId,
  })

  await recordEvent(
    "quote_submitted",
    await actor(),
    `${found.operator.name} on ${found.request.reference}`,
  )
  revalidatePath(`/console/rfqs/${found.request.id}`)
}

export async function acceptQuoteAction(formData: FormData): Promise<void> {
  const quoteId = String(formData.get("quoteId") ?? "")
  const found = await getQuote(quoteId)
  if (!found) return

  const booking = await acceptQuote(quoteId)
  await recordEvent(
    "quote_accepted",
    await actor(),
    `${booking.reference} — ${found.operator.name} at ${found.quote.estimatedTotalPaise} paise`,
  )

  redirect(`/console/bookings/${booking.id}`)
}

function problemsOf(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
}
