import type { DocumentKind } from "@/domain/compliance"
import { checkGstin, checkRegistration } from "@/domain/identifiers"
import { verificationConfig } from "./config.ts"

/**
 * VAHAN, Sarathi and the GSTN — §4.2's defensibility claim.
 *
 * "Most competitors accept a photo of a document and hope." The alternative is
 * checking the number against the government's own record, and that is what
 * this file does — through an authorised aggregator, because none of the three
 * is a public API. Access is resold to KYC'd businesses, which is why the base
 * URL and the provider name are configuration: the commercial choice between
 * aggregators must not be a code change.
 *
 * What comes back is normalised into one shape and written to
 * `compliance_check`, the same table an ops person writes to today when they
 * read the portal by hand. That is deliberate: when this integration is
 * switched on, what changes is who calls it, not what is stored or how a
 * vehicle is judged.
 */

export type VerificationOutcome = {
  passed: boolean
  /** One line, shown beside the document in the verification queue. */
  summary: string
  /** Everything the source returned, for the audit trail. */
  raw: string
  checkedAt: Date
}

/** Offline structural checks, run before spending a call on a number that cannot be real. */
export function preflight(kind: DocumentKind, number: string): { ok: boolean; reason: string } {
  if (number.trim() === "") return { ok: false, reason: "No number recorded" }

  if (kind === "rc") {
    const registration = checkRegistration(number)
    return registration.valid
      ? { ok: true, reason: "" }
      : { ok: false, reason: registration.reason }
  }

  return { ok: true, reason: "" }
}

type AggregatorResponse = {
  status?: string
  valid?: boolean
  message?: string
  data?: Record<string, unknown>
}

async function ask(path: string, body: Record<string, string>): Promise<AggregatorResponse> {
  const config = verificationConfig()

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // Government sources are slow and periodically down. A long timeout is
    // realistic; an unbounded one holds a server action open forever.
    signal: AbortSignal.timeout(20_000),
  })

  const text = await response.text()
  if (!response.ok) throw new Error(`Verification ${response.status}: ${text.slice(0, 300)}`)

  return JSON.parse(text) as AggregatorResponse
}

/**
 * VAHAN: the registration certificate, and with it fitness, permit and
 * insurance expiry as the authority holds them.
 *
 * The interesting answer is not "does this vehicle exist" — it is whether the
 * expiry dates the operator typed match the ones VAHAN has. An operator whose
 * fitness certificate expired last month and whose form says next year is not
 * a data-entry problem.
 */
export async function verifyRegistration(registrationNumber: string): Promise<VerificationOutcome> {
  const normalised = checkRegistration(registrationNumber)
  if (!normalised.valid) {
    return {
      passed: false,
      summary: `Not a valid registration number: ${normalised.reason}`,
      raw: "",
      checkedAt: new Date(),
    }
  }

  const answer = await ask("/vahan/rc", {
    registrationNumber: normalised.normalised.replace(/\s/g, ""),
  })
  const data = answer.data ?? {}

  const passed = answer.valid === true || answer.status === "success"
  const owner = typeof data.owner_name === "string" ? data.owner_name : "unknown owner"
  const fitness = typeof data.fitness_upto === "string" ? data.fitness_upto : "unknown"
  const insurance = typeof data.insurance_upto === "string" ? data.insurance_upto : "unknown"

  return {
    passed,
    summary: passed
      ? `VAHAN: ${owner}, fitness to ${fitness}, insurance to ${insurance}`
      : `VAHAN could not confirm this registration: ${answer.message ?? "no record"}`,
    raw: JSON.stringify(answer).slice(0, 4000),
    checkedAt: new Date(),
  }
}

/** Sarathi: the driving licence, and whether it is current. */
export async function verifyLicence(
  licenceNumber: string,
  dateOfBirth: string,
): Promise<VerificationOutcome> {
  const answer = await ask("/sarathi/dl", { licenceNumber: licenceNumber.trim(), dateOfBirth })
  const data = answer.data ?? {}

  const passed = answer.valid === true || answer.status === "success"
  const name = typeof data.name === "string" ? data.name : "unknown"
  const validTo = typeof data.valid_upto === "string" ? data.valid_upto : "unknown"

  return {
    passed,
    summary: passed
      ? `Sarathi: ${name}, valid to ${validTo}`
      : `Sarathi could not confirm this licence: ${answer.message ?? "no record"}`,
    raw: JSON.stringify(answer).slice(0, 4000),
    checkedAt: new Date(),
  }
}

/**
 * GSTIN, checked twice: the checksum offline, then the registration's status
 * with the GSTN.
 *
 * The offline check is free and catches the common case — a transposed pair of
 * characters copied off a certificate. Only a structurally valid number is
 * worth asking about, and an operator whose registration is *cancelled* is the
 * finding that matters, since §8.3's whole treatment of small suppliers turns
 * on their registration status.
 */
export async function verifyGstin(gstin: string): Promise<VerificationOutcome> {
  const structural = checkGstin(gstin)
  if (!structural.valid) {
    return {
      passed: false,
      summary: `Not a valid GSTIN: ${structural.reason}`,
      raw: "",
      checkedAt: new Date(),
    }
  }

  const answer = await ask("/gstn/taxpayer", { gstin: gstin.trim().toUpperCase() })
  const data = answer.data ?? {}

  const legalName = typeof data.legal_name === "string" ? data.legal_name : "unknown"
  const status = typeof data.status === "string" ? data.status : "unknown"
  const passed = (answer.valid === true || answer.status === "success") && status !== "Cancelled"

  return {
    passed,
    summary: passed
      ? `GSTN: ${legalName}, registration ${status}, ${structural.stateName}`
      : `GSTN: registration is ${status}`,
    raw: JSON.stringify(answer).slice(0, 4000),
    checkedAt: new Date(),
  }
}

/** Which source answers for which document, so the queue can offer the right button. */
export const SOURCE_FOR_DOCUMENT: Partial<Record<DocumentKind, "vahan" | "sarathi" | "gstn">> = {
  rc: "vahan",
  fitness: "vahan",
  insurance: "vahan",
  state_permit: "vahan",
  aitp: "vahan",
}
