"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { shapeOf, submitQuote } from "@/data/demand"
import { operatorQuote } from "@/data/scoped"
import { getSettings } from "@/data/settings"
import { recordEvent } from "@/db/events"
import { parseRupeesToPaise } from "@/domain/money"
import { type QuoteTerms, validateQuoteTerms } from "@/domain/quote"

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
