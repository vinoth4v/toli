/**
 * The Toli Fair Price band — §7.2.
 *
 * "Quotes for this trip usually fall between ₹24,000 and ₹31,000." High trust,
 * easy to explain, and deliberately *not* a price Toli sets: publishing a band
 * disciplines outliers without the platform fixing fares, which §8.4 says
 * would attract exactly the MVAG fare-regulation scrutiny worth avoiding.
 *
 * The band is descriptive statistics over past quotes and nothing more. It
 * appears only once there are enough comparable quotes to mean something —
 * a band drawn from three quotes is not a fact, it is an anecdote with a
 * decimal point.
 */

/** Below this, no band is shown at all. */
export const MINIMUM_SAMPLE = 5

export type PriceBand = {
  p25Paise: number
  p50Paise: number
  p75Paise: number
  sampleSize: number
}

/**
 * Linear-interpolated percentile over a sorted copy of the input.
 *
 * Interpolating rather than picking the nearest element keeps the band stable
 * as quotes arrive: with eight samples, the nearest-rank p25 jumps by a whole
 * quote each time a ninth appears, and a band that moves ₹2,000 overnight for
 * no reason reads as made up.
 */
export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0] ?? 0

  const position = (sorted.length - 1) * fraction
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted[lowerIndex] ?? 0
  const upper = sorted[upperIndex] ?? lower

  return Math.round(lower + (upper - lower) * (position - lowerIndex))
}

export function priceBand(totalsPaise: readonly number[]): PriceBand | null {
  if (totalsPaise.length < MINIMUM_SAMPLE) return null

  return {
    p25Paise: percentile(totalsPaise, 0.25),
    p50Paise: percentile(totalsPaise, 0.5),
    p75Paise: percentile(totalsPaise, 0.75),
    sampleSize: totalsPaise.length,
  }
}

/**
 * A route band, so quotes are compared against like trips.
 *
 * Distance is bucketed rather than exact: nobody has enough 287 km quotes, and
 * everybody has enough 200–400 km ones. Buckets follow how this market talks
 * about trips — a local run, a day out, an overnight, a tour.
 */
export const ROUTE_BANDS = [
  { key: "local", label: "Local (under 150 km)", maxKm: 150 },
  { key: "day", label: "Day trip (150–400 km)", maxKm: 400 },
  { key: "overnight", label: "Overnight (400–800 km)", maxKm: 800 },
  { key: "long", label: "Long haul (800 km+)", maxKm: Number.POSITIVE_INFINITY },
] as const

export type RouteBand = (typeof ROUTE_BANDS)[number]["key"]

export function routeBand(km: number): RouteBand {
  for (const band of ROUTE_BANDS) {
    if (km <= band.maxKm) return band.key
  }
  return "long"
}

export function routeBandLabel(band: RouteBand): string {
  return ROUTE_BANDS.find((entry) => entry.key === band)?.label ?? band
}

/** Comparability key: same route band, same vehicle class. §7.2 adds season once there is data. */
export function bandKey(vehicleClass: string, km: number): string {
  return `${vehicleClass}:${routeBand(km)}`
}

export type BandVerdict = "below" | "within" | "above"

/**
 * Where one quote sits against the band.
 *
 * Used on the comparison screen, and by ops when a quote is suspiciously
 * cheap — which in this market usually means an exclusion the customer has
 * not noticed rather than a bargain.
 */
export function verdict(totalPaise: number, band: PriceBand): BandVerdict {
  if (totalPaise < band.p25Paise) return "below"
  if (totalPaise > band.p75Paise) return "above"
  return "within"
}
