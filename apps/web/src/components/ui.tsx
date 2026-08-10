import type { ReactNode } from "react"
import { formatInr } from "@/domain/money"
import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
  ENQUIRY_STATUS_LABELS,
  type EnquiryStatus,
  OPERATOR_STATUS_LABELS,
  type OperatorStatus,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/domain/status"

/**
 * The handful of shapes every page repeats.
 *
 * Deliberately plain server components with no state: this app is forms and
 * server actions end to end, so anything that would need client JavaScript to
 * work is a feature that has not been thought through yet.
 */

type Tone = "neutral" | "accent" | "success" | "danger"

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

/** One colour vocabulary across every status, so a red always means trouble. */
export function EnquiryBadge({ status }: { status: EnquiryStatus }) {
  const tones: Record<EnquiryStatus, Tone> = {
    new: "accent",
    quoted: "neutral",
    won: "success",
    lost: "danger",
    cancelled: "danger",
  }
  return <Badge tone={tones[status]}>{ENQUIRY_STATUS_LABELS[status]}</Badge>
}

export function QuoteBadge({ status }: { status: QuoteStatus }) {
  const tones: Record<QuoteStatus, Tone> = {
    draft: "neutral",
    sent: "accent",
    accepted: "success",
    declined: "danger",
    expired: "danger",
  }
  return <Badge tone={tones[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>
}

export function BookingBadge({ status }: { status: BookingStatus }) {
  const tones: Record<BookingStatus, Tone> = {
    confirmed: "accent",
    on_trip: "accent",
    completed: "success",
    cancelled: "danger",
  }
  return <Badge tone={tones[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>
}

export function OperatorBadge({ status }: { status: OperatorStatus }) {
  const tones: Record<OperatorStatus, Tone> = {
    pending: "neutral",
    verified: "success",
    suspended: "danger",
  }
  return <Badge tone={tones[status]}>{OPERATOR_STATUS_LABELS[status]}</Badge>
}

export function Money({ paise }: { paise: number }) {
  return <span className="mono">{formatInr(paise)}</span>
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <li className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint ? <div className="stat-label">{hint}</div> : null}
    </li>
  )
}

export function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="actions">{children}</div> : null}
    </div>
  )
}

/**
 * Errors arrive as a query parameter because every mutation is a plain form
 * post to a server action — there is no client state to hold a message in, and
 * a redirect carrying the reason survives the round trip.
 */
export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null
  return <p role="alert">{message}</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function Line({
  label,
  value,
  total,
}: {
  label: string
  value: string
  total?: boolean
}) {
  return (
    <div className={total ? "total" : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
