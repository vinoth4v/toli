/**
 * Rupees in and out; paise in the middle.
 *
 * Every amount the app stores or calculates with is an integer count of
 * paise. These two functions are the only places that boundary is crossed,
 * which is what stops a rounding rule from being invented twice.
 */

/**
 * Parse what someone typed into a rupee field: "12,500", "12500.50", " 900 ".
 *
 * Returns null rather than NaN for anything that is not a non-negative
 * amount, so a caller has to decide what to do about it instead of
 * accidentally storing a NaN.
 */
export function parseRupees(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null
  }
  if (typeof input !== "string") return null

  const cleaned = input.replace(/[,\s₹]/g, "")
  if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null

  return Math.round(Number(cleaned) * 100)
}

/**
 * Format paise as rupees in Indian digit grouping — ₹1,23,456, not ₹123,456.
 *
 * Whole rupees by default: a charter quote is never discussed to the paisa,
 * and half a rupee of detail in a ₹48,000 total is noise that makes two
 * quotes harder to compare, which is the one thing this app is for.
 */
export function formatInr(paise: number, options?: { paisa?: boolean }): string {
  const showPaisa = options?.paisa === true
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showPaisa ? 2 : 0,
    maximumFractionDigits: showPaisa ? 2 : 0,
  }).format(paise / 100)
}

/** Basis points of an amount, rounded to the nearest paisa. 1000 bps = 10%. */
export function applyBps(paise: number, bps: number): number {
  return Math.round((paise * bps) / 10_000)
}
