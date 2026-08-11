"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { shapeOf, submitQuote } from "@/data/demand"
import {
  addOwnDocument,
  addOwnVehicle,
  addPhoto,
  ownsVehicle,
  removePhoto,
  retireOwnVehicle,
  uploadToken,
} from "@/data/fleet"
import { saveRate, setRateActive } from "@/data/rates"
import { operatorQuote } from "@/data/scoped"
import { getSettings } from "@/data/settings"
import { recordEvent } from "@/db/events"
import { DOCUMENT_KINDS } from "@/domain/compliance"
import { checkRegistration } from "@/domain/identifiers"
import { parseRupeesToPaise } from "@/domain/money"
import { type QuoteTerms, validateQuoteTerms } from "@/domain/quote"
import { SEGMENTS } from "@/domain/segment"
import { VEHICLE_CLASSES } from "@/domain/vehicle"
import { photoKey, presignPut, publicUrl, storageConfig } from "@/integrations/storage"

/**
 * What a fleet operator may do.
 *
 * One action, and it is the one the marketplace lives on: answering an RFQ.
 * The quote is validated by the same `validateQuoteTerms` the ops console
 * uses, so an operator cannot submit through their own screen a quote that
 * would be refused on Toli's — which is the only way "every quote is
 * comparable" stays true once operators are typing them themselves.
 */

async function operatorId(): Promise<string> {
  const session = await auth()
  const id = session?.user.operatorId
  if (!id || session?.user.role !== "operator") redirect("/login")
  return id
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  const trimmed = String(value ?? "").trim()
  if (trimmed === "") return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

export async function submitOwnQuoteAction(formData: FormData): Promise<void> {
  const quoteId = String(formData.get("quoteId") ?? "")
  if (!quoteId) return

  const id = await operatorId()

  // Scoped lookup: an operator can only answer a request they were asked about.
  const found = await operatorQuote(id, quoteId)
  if (!found) redirect("/partner")

  const back = `/partner/quotes/${quoteId}`

  let terms: QuoteTerms
  try {
    terms = {
      baseFarePaise: parseRupeesToPaise(String(formData.get("baseFare") ?? "0")),
      includedKm: optionalInt(formData.get("includedKm")),
      includedHours: optionalInt(formData.get("includedHours")),
      extraKmRatePaise: String(formData.get("extraKmRate") ?? "").trim()
        ? parseRupeesToPaise(String(formData.get("extraKmRate")))
        : null,
      extraHourRatePaise: String(formData.get("extraHourRate") ?? "").trim()
        ? parseRupeesToPaise(String(formData.get("extraHourRate")))
        : null,
      perKmRatePaise: String(formData.get("perKmRate") ?? "").trim()
        ? parseRupeesToPaise(String(formData.get("perKmRate")))
        : null,
      minKmPerDay: optionalInt(formData.get("minKmPerDay")),
      driverBataPerDayPaise: parseRupeesToPaise(String(formData.get("driverBata") ?? "0")),
      nightHaltPaise: parseRupeesToPaise(String(formData.get("nightHalt") ?? "0")),
      tollIncluded: formData.get("tollIncluded") === "on",
      parkingIncluded: formData.get("parkingIncluded") === "on",
      statePermitIncluded: formData.get("statePermitIncluded") === "on",
      fuelIncluded: formData.get("fuelIncluded") === "on",
      gstTreatment: found.quote.gstTreatment,
    }
  } catch (error) {
    redirect(
      `${back}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Amounts must be in rupees",
      )}`,
    )
  }

  const shape = shapeOf(found.request)
  const problems = validateQuoteTerms(terms, shape)
  if (problems.length > 0) {
    redirect(`${back}?error=${encodeURIComponent(problems.join(" "))}`)
  }

  const settings = await getSettings()
  await submitQuote(quoteId, terms, shape, {
    validUntil: new Date(Date.now() + settings.quoteValidityHours * 3_600_000),
    notes: String(formData.get("notes") ?? "").trim() || null,
    vehicleId: String(formData.get("vehicleId") ?? "").trim() || null,
  })

  await recordEvent("quote_submitted", `operator:${id}`, `${found.request.reference} via partner`)

  revalidatePath("/partner")
  redirect("/partner")
}

/**
 * Saving a standing rate.
 *
 * Validated the same way a typed quote is: a rate with no minimum km per day
 * would produce instant offers that hide the charge §7.1 singles out, which
 * is precisely the thing this marketplace exists to stop — and it would be
 * worse here, because nobody is reading it before it is sold.
 */
export async function saveRateAction(formData: FormData): Promise<void> {
  const id = await operatorId()

  const segment = String(formData.get("segment") ?? "")
  const vehicleClass = String(formData.get("vehicleClass") ?? "")

  if (!(SEGMENTS as readonly string[]).includes(segment)) return
  if (!(VEHICLE_CLASSES as readonly string[]).includes(vehicleClass)) return

  let perKmRatePaise: number
  let driverBataPerDayPaise: number
  let nightHaltPaise: number
  let baseFarePaise: number
  try {
    perKmRatePaise = parseRupeesToPaise(String(formData.get("perKmRate") ?? ""))
    driverBataPerDayPaise = parseRupeesToPaise(String(formData.get("driverBata") ?? "0"))
    nightHaltPaise = parseRupeesToPaise(String(formData.get("nightHalt") ?? "0"))
    baseFarePaise = parseRupeesToPaise(String(formData.get("baseFare") ?? "0"))
  } catch (error) {
    redirect(
      `/partner/rates?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Amounts must be in rupees",
      )}`,
    )
  }

  const minKmPerDay = Number(formData.get("minKmPerDay") ?? "0")

  if (perKmRatePaise <= 0) {
    redirect(`/partner/rates?error=${encodeURIComponent("A rate per km is required.")}`)
  }
  if (!Number.isFinite(minKmPerDay) || minKmPerDay <= 0) {
    redirect(
      `/partner/rates?error=${encodeURIComponent(
        "Minimum km per day is required — it is the charge customers are most often surprised by, and every quote must show it.",
      )}`,
    )
  }

  await saveRate({
    operatorId: id,
    segment: segment as "economy" | "premium" | "luxury",
    vehicleClass: vehicleClass as never,
    perKmRatePaise,
    minKmPerDay: Math.round(minKmPerDay),
    baseFarePaise,
    driverBataPerDayPaise,
    nightHaltPaise,
    tollIncluded: formData.get("tollIncluded") === "on",
    parkingIncluded: formData.get("parkingIncluded") === "on",
    statePermitIncluded: formData.get("statePermitIncluded") === "on",
    active: true,
  })

  await recordEvent("settings_updated", `operator:${id}`, `rate ${segment}/${vehicleClass}`)
  revalidatePath("/partner/rates")
  redirect("/partner/rates?saved=1")
}

export async function toggleRateAction(formData: FormData): Promise<void> {
  const id = await operatorId()
  const rateId = String(formData.get("rateId") ?? "")
  if (!rateId) return

  await setRateActive(id, rateId, formData.get("active") === "on")
  revalidatePath("/partner/rates")
}

/* ---------------------------------------------------------------- fleet */

/**
 * Adding a vehicle.
 *
 * The registration is normalised before it is stored, because the same plate
 * arrives as "TN58AL4521", "TN-58-AL-4521" and "tn 58 al 4521", and a unique
 * index only means something if the value is canonical first.
 *
 * It lands `pending_verification`. §4.2 does not let an operator self-certify
 * a vehicle onto the road, and that rule is the reason a customer can trust
 * anything on this platform.
 */
export async function addVehicleAction(formData: FormData): Promise<void> {
  const id = await operatorId()

  const registration = checkRegistration(String(formData.get("registrationNumber") ?? ""))
  if (!registration.valid) {
    redirect(`/partner/fleet?error=${encodeURIComponent(registration.reason)}`)
  }

  const vehicleClass = String(formData.get("vehicleClass") ?? "")
  if (!(VEHICLE_CLASSES as readonly string[]).includes(vehicleClass)) return

  const seats = Number(formData.get("seats") ?? "0")
  const year = Number(formData.get("yearOfManufacture") ?? "0")

  if (!Number.isFinite(seats) || seats < 4) {
    redirect(`/partner/fleet?error=${encodeURIComponent("How many seats does it have?")}`)
  }
  if (!Number.isFinite(year) || year < 1990 || year > new Date().getFullYear() + 1) {
    redirect(`/partner/fleet?error=${encodeURIComponent("Check the year of manufacture.")}`)
  }

  const { segment } = await addOwnVehicle({
    operatorId: id,
    registrationNumber: registration.normalised,
    vehicleClass: vehicleClass as never,
    seats: Math.round(seats),
    ac: formData.get("ac") === "on",
    yearOfManufacture: Math.round(year),
    fuelType: String(formData.get("fuelType") ?? "").trim() || null,
    features: formData.getAll("features").map(String),
  })

  await recordEvent("vehicle_created", `operator:${id}`, `${registration.normalised} (${segment})`)
  redirect(`/partner/fleet?saved=${encodeURIComponent(registration.normalised)}`)
}

/** Removing a vehicle retires it. Bookings and settlements still refer to it. */
export async function retireVehicleAction(formData: FormData): Promise<void> {
  const id = await operatorId()
  const vehicleId = String(formData.get("vehicleId") ?? "")
  if (!vehicleId) return

  await retireOwnVehicle(id, vehicleId)
  await recordEvent("vehicle_status_changed", `operator:${id}`, `${vehicleId} retired`)
  revalidatePath("/partner/fleet")
}

export async function addDocumentAction(formData: FormData): Promise<void> {
  const id = await operatorId()
  const vehicleId = String(formData.get("vehicleId") ?? "")
  const kind = String(formData.get("kind") ?? "")

  if (!vehicleId || !(DOCUMENT_KINDS as readonly string[]).includes(kind)) return

  await addOwnDocument({
    operatorId: id,
    vehicleId,
    kind: kind as never,
    number: String(formData.get("number") ?? "").trim() || null,
    expiresOn: String(formData.get("expiresOn") ?? "").trim() || null,
  })

  revalidatePath("/partner/fleet")
}

/* --------------------------------------------------------------- photos */

/**
 * Mints a presigned URL so the browser can PUT straight to the bucket.
 *
 * The image never passes through this app: a serverless function billed by the
 * millisecond is the wrong place for a four-megabyte photograph.
 */
export async function presignPhotoAction(input: {
  vehicleId: string
  filename: string
}): Promise<{ uploadUrl: string; publicUrl: string; storageKey: string } | { error: string }> {
  const id = await operatorId()
  if (!(await ownsVehicle(id, input.vehicleId))) return { error: "Not your vehicle" }

  const config = storageConfig()
  if (!config) {
    return {
      error:
        "Photo hosting is not configured (S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY). Paste a link to a photo you host instead.",
    }
  }

  const storageKey = photoKey(input.vehicleId, input.filename, uploadToken())

  return {
    uploadUrl: presignPut({ config, key: storageKey }),
    publicUrl: publicUrl(config, storageKey),
    storageKey,
  }
}

export async function recordPhotoAction(input: {
  vehicleId: string
  url: string
  storageKey: string | null
  kind: string
  caption: string | null
}): Promise<void> {
  const id = await operatorId()
  const kinds = ["exterior", "interior", "seats", "boot", "documents"]

  await addPhoto({
    operatorId: id,
    vehicleId: input.vehicleId,
    kind: (kinds.includes(input.kind) ? input.kind : "exterior") as never,
    url: input.url,
    storageKey: input.storageKey,
    caption: input.caption,
  })

  revalidatePath("/partner/fleet")
}

/** Linking a photo hosted elsewhere — the path that works with no bucket. */
export async function linkPhotoAction(formData: FormData): Promise<void> {
  const vehicleId = String(formData.get("vehicleId") ?? "")
  const url = String(formData.get("url") ?? "").trim()

  if (!vehicleId || !url) return
  if (!/^https:\/\//.test(url)) {
    redirect(`/partner/fleet?error=${encodeURIComponent("A photo link must start with https://")}`)
  }

  await recordPhotoAction({
    vehicleId,
    url,
    storageKey: null,
    kind: String(formData.get("kind") ?? "exterior"),
    caption: String(formData.get("caption") ?? "").trim() || null,
  })
}

export async function removePhotoAction(formData: FormData): Promise<void> {
  const id = await operatorId()
  const photoId = String(formData.get("photoId") ?? "")
  if (!photoId) return

  await removePhoto(id, photoId)
  revalidatePath("/partner/fleet")
}
