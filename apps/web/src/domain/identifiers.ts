import { STATES } from "./india.ts"

/**
 * Indian identifier validation, done offline.
 *
 * Every one of these can be checked for structural validity without calling
 * anybody — a GSTIN carries its own checksum, a vehicle registration follows a
 * published format, a phone number is either ten digits starting 6–9 or it is
 * not a mobile. Doing that here means the ops desk is told about a typo in the
 * half-second before the form submits, rather than in a rejected invoice three
 * weeks later or a ₹4 API call that was always going to fail.
 *
 * None of this proves a document is genuine. That needs VAHAN or the GSTN, and
 * it is a different question: this file answers "could this possibly be real",
 * the verification adapter answers "is it".
 */

/* ------------------------------------------------------------------ GSTIN */

const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/

export type GstinCheck =
  | { valid: true; stateCode: string; stateName: string; pan: string }
  | { valid: false; reason: string }

/**
 * Validates a GSTIN including its check digit.
 *
 * The fifteenth character is a modulus-36 checksum over the first fourteen,
 * with digits at even positions doubled — the same idea as a Luhn check. A
 * transposed pair of characters fails it, which is exactly the error a person
 * copying a number off a certificate makes.
 */
export function checkGstin(raw: string): GstinCheck {
  const gstin = raw.trim().toUpperCase()

  if (gstin.length !== 15) return { valid: false, reason: "A GSTIN is 15 characters" }
  if (!GSTIN_PATTERN.test(gstin)) return { valid: false, reason: "Not in the GSTIN format" }

  const stateCode = gstin.slice(0, 2)
  const state = STATES.find((entry) => entry.code === stateCode)
  if (!state) return { valid: false, reason: `${stateCode} is not a state code` }

  let total = 0
  for (let position = 0; position < 14; position += 1) {
    const value = GSTIN_ALPHABET.indexOf(gstin[position] as string)
    // Even positions (1-indexed) are doubled, and a product that overflows the
    // 36-character alphabet is folded back into it.
    const weighted = value * (position % 2 === 0 ? 1 : 2)
    total += Math.floor(weighted / 36) + (weighted % 36)
  }

  const expected = GSTIN_ALPHABET[(36 - (total % 36)) % 36]
  if (expected !== gstin[14]) {
    return { valid: false, reason: "Check digit does not match — probably a typo" }
  }

  return { valid: true, stateCode, stateName: state.name, pan: gstin.slice(2, 12) }
}

/* -------------------------------------------------------------------- PAN */

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export function isValidPan(raw: string): boolean {
  return PAN_PATTERN.test(raw.trim().toUpperCase())
}

/* ----------------------------------------------------- vehicle registration */

/**
 * `RJ 14 PA 4521` and its variants.
 *
 * Spacing is not standardised anywhere in practice — operators write RJ14PA4521,
 * RJ-14-PA-4521, or with spaces — so the value is normalised to one canonical
 * spaced form before it is stored, which is what makes the unique index on
 * registration mean anything at all.
 */
const REGISTRATION_PATTERN = /^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$/

export type RegistrationCheck =
  | { valid: true; normalised: string; stateCode: string }
  | { valid: false; reason: string }

export function checkRegistration(raw: string): RegistrationCheck {
  const compact = raw.toUpperCase().replace(/[\s-]/g, "")
  const match = REGISTRATION_PATTERN.exec(compact)

  if (!match) return { valid: false, reason: "Not a vehicle registration number" }

  const [, region, district, series, number] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
  ]

  return {
    valid: true,
    stateCode: region,
    normalised: [region, district.padStart(2, "0"), series, number.padStart(4, "0")]
      .filter((part) => part !== "")
      .join(" "),
  }
}

/* ------------------------------------------------------------------ phone */

/**
 * Indian mobile numbers, normalised to E.164.
 *
 * WhatsApp and every DLT-registered SMS provider want `919829011234` — no
 * plus, no spaces, country code included. Customers type all of
 * `+91 98290 11234`, `098290-11234` and `9829011234`, and a message that
 * silently does not send because of a leading zero is the failure mode this
 * prevents.
 *
 * A mobile number starts 6, 7, 8 or 9. A landline does not, and cannot receive
 * a WhatsApp template, so it is rejected rather than quietly queued.
 */
export type PhoneCheck =
  | { valid: true; e164: string; national: string }
  | { valid: false; reason: string }

export function checkIndianMobile(raw: string): PhoneCheck {
  const digits = raw.replace(/\D/g, "")

  const national =
    digits.startsWith("91") && digits.length === 12
      ? digits.slice(2)
      : digits.startsWith("0") && digits.length === 11
        ? digits.slice(1)
        : digits

  if (national.length !== 10)
    return { valid: false, reason: "An Indian mobile number is 10 digits" }
  if (!/^[6-9]/.test(national)) {
    return { valid: false, reason: "Mobile numbers start with 6, 7, 8 or 9" }
  }

  return { valid: true, e164: `91${national}`, national }
}

/** What a provider wants in a `to` field. Throws rather than send to nowhere. */
export function toE164(raw: string): string {
  const check = checkIndianMobile(raw)
  if (!check.valid) throw new Error(`Cannot message "${raw}": ${check.reason}`)
  return check.e164
}
