/**
 * Times are stored UTC and rendered IST — §9, and the reason is that every
 * person who reads this app is in one time zone. A departure at "06:00" means
 * six in the morning in Jaipur, and no screen should ever make an ops person
 * do the arithmetic at 5 AM.
 *
 * Reference codes live here too: they are what a customer reads out on a phone
 * call, so they are short, unambiguous, and never contain a letter that can be
 * mistaken for a digit.
 */

const IST = "Asia/Kolkata"

const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
})

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const timeOnly = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
})

export function formatIst(at: Date | string | null | undefined): string {
  if (!at) return "—"
  const value = typeof at === "string" ? new Date(at) : at
  return `${dateTime.format(value)} IST`
}

export function formatIstDate(at: Date | string | null | undefined): string {
  if (!at) return "—"
  return dateOnly.format(typeof at === "string" ? new Date(at) : at)
}

export function formatIstTime(at: Date | string | null | undefined): string {
  if (!at) return "—"
  return timeOnly.format(typeof at === "string" ? new Date(at) : at)
}

/** "in 3 days", "2 hours ago" — for queues, where the age is the priority. */
export function relativeToNow(at: Date | string, now: Date = new Date()): string {
  const value = typeof at === "string" ? new Date(at) : at
  const minutes = Math.round((value.getTime() - now.getTime()) / 60_000)
  const absolute = Math.abs(minutes)

  const [amount, unit]: [number, Intl.RelativeTimeFormatUnit] =
    absolute < 60
      ? [minutes, "minute"]
      : absolute < 60 * 24
        ? [Math.round(minutes / 60), "hour"]
        : [Math.round(minutes / (60 * 24)), "day"]

  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(amount, unit)
}

/**
 * The value a `datetime-local` input wants, in IST.
 *
 * That input has no time zone, so it must be handed wall-clock IST or the ops
 * desk types 6 AM and gets 11:30 AM. Formatting parts explicitly is the only
 * way to do this without a date library.
 */
export function toIstInputValue(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at)

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

/** The inverse: what the ops desk typed, read as IST, stored as UTC. */
export function fromIstInputValue(value: string): Date {
  // IST is a fixed +05:30 with no daylight saving, so appending the offset is
  // exact — no lookup table, no library.
  return new Date(`${value}:00+05:30`)
}

/**
 * TOLI-R-000123, TOLI-B-000123.
 *
 * Zero-padded so codes sort and align in a list, and prefixed by kind so an
 * operator reading one aloud cannot confuse a request with a booking.
 */
export function reference(prefix: "R" | "B", sequence: number): string {
  return `TOLI-${prefix}-${String(sequence).padStart(6, "0")}`
}

/** GST invoices need a series that is unbroken within a financial year. */
export function invoiceNumber(financialYear: string, sequence: number): string {
  return `TOLI/${financialYear}/${String(sequence).padStart(5, "0")}`
}

/**
 * The Indian financial year an instant falls in: April to March.
 *
 * Invoice numbering resets with it, so this is not cosmetic.
 */
export function financialYear(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(at)
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0")
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1")
  const start = month >= 4 ? year : year - 1
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`
}

/**
 * The alphabet tracking links are drawn from — not a secret itself, which is
 * why it is not called one. A constant named `TOKEN_ANYTHING` holding
 * twenty-odd unusual characters reads to a secret scanner exactly like a
 * leaked credential, and a gate that cries wolf is a gate people learn to
 * ignore.
 *
 * No vowels, so no dictionary word can appear in a link a customer forwards
 * to sixty wedding guests; no O/0 or I/1, so it survives being read aloud.
 */
const LINK_CODE_ALPHABET = "23456789bcdfghjkmnpqrstvwxz"

/** The tracking link's only credential, so it has to be unguessable. */
export function trackingToken(length = 20): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => LINK_CODE_ALPHABET[byte % LINK_CODE_ALPHABET.length]).join("")
}

/** Phone numbers are masked in every log and every list — §8.6, and §10's number masking. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return "•••"
  return `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}
