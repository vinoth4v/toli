/**
 * Money is paise, always, and always an integer.
 *
 * A charter fare is built from a per-km rate multiplied by a distance and then
 * split into commission and payout — three places where a floating-point rupee
 * loses a paisa and the operator's settlement stops reconciling. Integers in,
 * integers out; the only rounding is explicit and happens here.
 */

/** Paise in one rupee. */
export const PAISE = 100

/** Multiply `paise` by a basis-point rate, rounding half away from zero. */
export function applyBps(paise: number, bps: number): number {
  return Math.round((paise * bps) / 10_000)
}

/** Rupees (possibly fractional, as typed by a human) to whole paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE)
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * Display form: "₹18,540". Whole rupees — Indian charter quotes are never
 * argued about in paise, and the extra two digits only add noise to a table.
 * The stored value keeps its precision regardless.
 */
export function formatInr(paise: number): string {
  return inr.format(Math.round(paise / PAISE))
}

/** Display form with paise, for a settlement line that must reconcile exactly. */
export function formatInrExact(paise: number): string {
  const sign = paise < 0 ? "-" : ""
  const abs = Math.abs(paise)
  const whole = Math.floor(abs / PAISE)
  const rest = String(abs % PAISE).padStart(2, "0")
  return `${sign}${new Intl.NumberFormat("en-IN").format(whole)}.${rest}`
}

/** Basis points as a human percentage: 1250 -> "12.5%". */
export function formatBps(bps: number): string {
  const pct = bps / 100
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`
}
