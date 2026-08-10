/**
 * Money is paise, always, as an integer.
 *
 * §9 of the build plan makes this a rule rather than a preference, and the
 * reason is settlement: a ₹28,400 fare split into commission, TCS, TDS and a
 * driver's cash collection has to add back up to exactly ₹28,400, and floats
 * do not. Every function here takes and returns whole paise; rupees exist only
 * at the two edges — a form input and a rendered string.
 */

/** Paise in a rupee. Named so the arithmetic below reads as arithmetic. */
export const PAISE = 100

const rupeeFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const rupeeFormatWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * ₹28,400 — in the Indian digit grouping, which is not the western one and
 * which every customer here reads faster.
 *
 * Whole rupees drop the decimals: an ops screen full of `₹28,400.00` is
 * harder to scan, and quotes in this market are quoted in whole rupees.
 */
export function formatPaise(paise: number): string {
  const negative = paise < 0
  const value = Math.abs(paise)
  const formatted =
    value % PAISE === 0
      ? rupeeFormat.format(value / PAISE)
      : rupeeFormatWithPaise.format(value / PAISE)
  return negative ? `−${formatted}` : formatted
}

/** ₹28,400 → "28400", for pre-filling a form the operator will edit. */
export function paiseToRupeeInput(paise: number): string {
  return paise % PAISE === 0 ? String(paise / PAISE) : (paise / PAISE).toFixed(2)
}

/**
 * Parses what someone typed into a rupee field: "28400", "28,400", "₹28,400",
 * "28400.50", " " (which is a zero, not an error, for optional charges).
 *
 * Rejects rather than rounds anything finer than a paisa — a rate card with
 * three decimal places is a data-entry mistake, and silently truncating it is
 * how a per-km rate ends up 0.4% wrong across ten thousand kilometres.
 */
export function parseRupeesToPaise(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0
  const raw = String(input).trim()
  if (raw === "") return 0

  const cleaned = raw.replace(/[₹,\s]/g, "")
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`"${raw}" is not an amount in rupees`)
  }

  const [whole = "0", fraction = ""] = cleaned.split(".")
  const sign = whole.startsWith("-") ? -1 : 1
  const wholePaise = Math.abs(Number(whole)) * PAISE
  const fractionPaise = Number(fraction.padEnd(2, "0") || "0")
  return sign * (wholePaise + fractionPaise)
}

/**
 * A basis-point share of an amount, rounded half-up to the paisa.
 *
 * Basis points rather than percent because 10% commission and 1% TCS are both
 * expressible as integers here, and a commission stored as `0.1` is a float
 * back in the settlement path we just spent this file avoiding.
 */
export function applyBps(paise: number, bps: number): number {
  return Math.round((paise * bps) / 10_000)
}

/** 1000 → "10%", 850 → "8.5%". Rates are shown to operators constantly. */
export function formatBps(bps: number): string {
  const percent = bps / 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`
}

export function sumPaise(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0)
}
