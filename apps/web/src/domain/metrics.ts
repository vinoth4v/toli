/**
 * §13's metrics, computed here so the dashboard cannot invent its own
 * definitions.
 *
 * The plan is emphatic about one of them: *quote response rate is the metric.
 * If it falls below 50%, nothing else matters.* So it is defined precisely —
 * the share of RFQs that received at least three quotes within thirty minutes
 * — rather than as whatever the SQL happened to say that week.
 *
 * The anti-metrics of §13 (app downloads, raw operator count) are deliberately
 * absent. A number on a dashboard gets optimised; these two should not be.
 */

/** §13: at least three quotes, within thirty minutes. */
export const RESPONSE_QUORUM = 3
export const RESPONSE_WINDOW_MINUTES = 30

export type RequestSample = {
  createdAt: Date
  /** Submission times of quotes against this request. Unsubmitted quotes are not quotes. */
  quotedAt: Date[]
  booked: boolean
}

export type MarketplaceHealth = {
  requests: number
  /** Share of requests with ≥3 quotes inside 30 minutes. Target: 60% (§11 Phase 2). */
  responseRate: number
  /** Median minutes to the first quote. Target: under 10 (§13). */
  medianMinutesToFirstQuote: number | null
  /** Share of requests that became bookings. Target: 25%+. */
  conversionRate: number
  /** Requests that never received a single quote — the supply gap, in one number. */
  unquoted: number
}

export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? null
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

export function marketplaceHealth(samples: readonly RequestSample[]): MarketplaceHealth {
  if (samples.length === 0) {
    return {
      requests: 0,
      responseRate: 0,
      medianMinutesToFirstQuote: null,
      conversionRate: 0,
      unquoted: 0,
    }
  }

  let responded = 0
  let booked = 0
  let unquoted = 0
  const firstQuoteDelays: number[] = []

  for (const sample of samples) {
    const inWindow = sample.quotedAt.filter(
      (at) => minutesBetween(sample.createdAt, at) <= RESPONSE_WINDOW_MINUTES,
    )
    if (inWindow.length >= RESPONSE_QUORUM) responded += 1
    if (sample.booked) booked += 1
    if (sample.quotedAt.length === 0) {
      unquoted += 1
    } else {
      const earliest = Math.min(...sample.quotedAt.map((at) => at.getTime()))
      firstQuoteDelays.push(minutesBetween(sample.createdAt, new Date(earliest)))
    }
  }

  return {
    requests: samples.length,
    responseRate: responded / samples.length,
    medianMinutesToFirstQuote: median(firstQuoteDelays),
    conversionRate: booked / samples.length,
    unquoted,
  }
}

/**
 * §13's operational trust block. On-time arrival is called out as "the single
 * trust metric this business lives on", so it gets a definition with a real
 * tolerance rather than a nod: the vehicle started within fifteen minutes of
 * the promised time.
 */
export const ON_TIME_TOLERANCE_MINUTES = 15

export type ExecutionSample = {
  scheduledStartAt: Date
  actualStartAt: Date | null
  cancelledByOperator: boolean
  matchedBooking: boolean
}

export type OperationalTrust = {
  trips: number
  onTimeRate: number | null
  operatorCancellationRate: number
  matchRate: number | null
}

export function operationalTrust(samples: readonly ExecutionSample[]): OperationalTrust {
  if (samples.length === 0) {
    return { trips: 0, onTimeRate: null, operatorCancellationRate: 0, matchRate: null }
  }

  const started = samples.filter((sample) => sample.actualStartAt !== null)
  const onTime = started.filter(
    (sample) =>
      minutesBetween(sample.scheduledStartAt, sample.actualStartAt as Date) <=
      ON_TIME_TOLERANCE_MINUTES,
  )
  const matched = started.filter((sample) => sample.matchedBooking)

  return {
    trips: samples.length,
    onTimeRate: started.length === 0 ? null : onTime.length / started.length,
    operatorCancellationRate:
      samples.filter((sample) => sample.cancelledByOperator).length / samples.length,
    matchRate: started.length === 0 ? null : matched.length / started.length,
  }
}

/**
 * §10's leakage proxy: an operator whose quotes stop converting is either
 * uncompetitive or taking the business off-platform, and both are worth a
 * phone call. Only flags operators with enough quotes to judge.
 */
export const LEAKAGE_MINIMUM_QUOTES = 8
export const LEAKAGE_CONVERSION_FLOOR = 0.05

export function leakageSuspect(input: { quotes: number; bookings: number }): boolean {
  if (input.quotes < LEAKAGE_MINIMUM_QUOTES) return false
  return input.bookings / input.quotes < LEAKAGE_CONVERSION_FLOOR
}

/** 0.6234 → "62%". Rates are read at a glance; a third digit is noise. */
export function formatRate(rate: number | null): string {
  if (rate === null) return "—"
  return `${Math.round(rate * 100)}%`
}
