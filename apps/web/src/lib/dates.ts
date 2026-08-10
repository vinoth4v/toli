/**
 * Trip dates are calendar dates, not instants.
 *
 * A vehicle booked for the 3rd is booked for the 3rd in Jaipur, whatever
 * timezone the browser or the serverless region happens to be in. Everything
 * here therefore parses and formats in UTC and never touches local time.
 */

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

function parseDay(iso: string): Date | null {
  const value = Date.parse(`${iso}T00:00:00Z`)
  return Number.isNaN(value) ? null : new Date(value)
}

export function formatDay(iso: string): string {
  const date = parseDay(iso)
  return date ? dayFormat.format(date) : iso
}

/** "3 Aug 2026 – 5 Aug 2026", collapsed to one date for a same-day trip. */
export function formatRange(start: string, end: string): string {
  return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`
}

/**
 * Whole days from today until a date: negative in the past, 0 today.
 *
 * Takes `now` so the caller can be tested. Charter is booked three days to
 * three months ahead, and how close a departure is decides what the desk
 * looks at first.
 */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = parseDay(iso)
  if (!target) return 0

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((target.getTime() - today) / 86_400_000)
}

/** How urgent a departure reads on the desk. */
export function departureLabel(iso: string, now: Date = new Date()): string {
  const days = daysUntil(iso, now)
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  return `In ${days} days`
}
