import { Fragment, type ReactNode } from "react"
import { formatPaise } from "@/domain/money"

/**
 * The small set of shapes every console screen is built from.
 *
 * Server components with no state: the console is forms and tables, and a
 * client bundle buys nothing here. Styling lives in globals.css against design
 * tokens, so these components carry class names and never inline styles.
 */

export function PageHead({
  title,
  intro,
  actions,
}: {
  title: string
  intro?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {intro ? <p>{intro}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  )
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  )
}

/** Money is always rendered through here, so it is always paise and always ₹. */
export function Amount({ paise, className }: { paise: number; className?: string }) {
  return (
    <span className={className ? `numeric ${className}` : "numeric"}>{formatPaise(paise)}</span>
  )
}

export type BadgeTone = "ok" | "warn" | "stop" | "neutral"

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={tone === "neutral" ? "badge" : `badge ${tone}`}>{children}</span>
}

export function Chip({
  tone = "info",
  children,
}: {
  tone?: "included" | "excluded" | "info"
  children: ReactNode
}) {
  return <span className={`chip ${tone}`}>{children}</span>
}

export function Tile({
  label,
  value,
  target,
  tone,
}: {
  label: string
  value: ReactNode
  target?: string
  tone?: "good" | "bad"
}) {
  return (
    <div className={tone ? `tile ${tone}` : "tile"}>
      <dt>{label}</dt>
      <dd>
        {value}
        {target ? <span className="target">{target}</span> : null}
      </dd>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="notice">{children}</p>
}

export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="facts">
      {items.map(([term, value]) => (
        // Fragments, not a wrapper element: the list is a two-column grid, and
        // a div around each pair would take one cell and collapse the columns.
        <Fragment key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

/** Booking and request statuses read at a glance, in one place. */
export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === "completed" || status === "active" || status === "booked" || status === "paid"
      ? "ok"
      : status === "cancelled" || status === "suspended" || status === "expired"
        ? "stop"
        : "warn"

  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>
}
