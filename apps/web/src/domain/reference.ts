/**
 * Human-quotable references.
 *
 * A UUID is correct and unusable: nobody reads one out to a driver at a pickup
 * point. Every enquiry and booking also carries a short code shaped like
 * "TL-260810-K4P2" — date-prefixed so it sorts and ages visibly, with four
 * random characters so two enquiries taken in the same minute cannot collide.
 */

/** No vowels, no 0/O/1/I — a code read aloud over a bad line survives it. */
const ALPHABET = "23456789CFGHJKLMNPQRSTVWXZ"

export type RefPrefix = "TL" | "BK"

/** Deterministic given its inputs, so the test does not need a fixed clock. */
export function formatRef(prefix: RefPrefix, at: Date, suffix: string): string {
  const yy = String(at.getUTCFullYear() % 100).padStart(2, "0")
  const mm = String(at.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(at.getUTCDate()).padStart(2, "0")
  return `${prefix}-${yy}${mm}${dd}-${suffix}`
}

export function randomSuffix(length = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => ALPHABET.charAt(byte % ALPHABET.length)).join("")
}

export function newRef(prefix: RefPrefix, at: Date = new Date()): string {
  return formatRef(prefix, at, randomSuffix())
}
