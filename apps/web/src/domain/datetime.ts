/**
 * Every time in this app is India Standard Time, stated rather than assumed.
 *
 * The operator, the driver and the group are all in one time zone; the server
 * is in UTC. A `datetime-local` input hands back "2026-08-15T06:30" with no
 * offset, and `new Date()` would read that in whatever zone the process
 * happens to run in — correct on a laptop in Chennai, five and a half hours
 * wrong on Vercel. So the offset is applied explicitly, in both directions.
 */

const IST = "Asia/Kolkata"
const IST_OFFSET = "+05:30"

/** Parse a `datetime-local` value as IST. Returns null if it is not one. */
export function parseIstLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}:00${IST_OFFSET}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** The inverse: an instant as the `datetime-local` value that round-trips it. */
export function toIstLocalInput(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00"

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

/** "15 Aug 2026, 6:30 am" — how a dispatcher reads a departure. */
export function formatIst(at: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at)
}

/** "15 Aug 2026" — for a date with no meaningful time of day. */
export function formatIstDate(at: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(at)
}

/** Whole days from now until `at`; negative once it is in the past. */
export function daysUntil(at: Date, now: Date = new Date()): number {
  return Math.floor((at.getTime() - now.getTime()) / 86_400_000)
}

/** "in 3 days" / "tomorrow" / "2 days ago" — a departure at a glance. */
export function relativeDays(at: Date, now: Date = new Date()): string {
  const days = daysUntil(at, now)
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`
}
