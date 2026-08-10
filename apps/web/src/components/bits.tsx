import type { ReactNode } from "react"

export type Tone = "accent" | "success" | "danger" | "muted"

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

/** The tone a lifecycle status reads in. Unknown statuses stay quiet. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "open":
    case "submitted":
      return "accent"
    case "awarded":
    case "confirmed":
    case "completed":
      return "success"
    case "cancelled":
    case "declined":
      return "danger"
    default:
      return "muted"
  }
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  )
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title || action ? (
        <div className="card-head">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/**
 * What a list says when it is empty.
 *
 * Always with the next action attached: an empty screen that only says
 * "nothing here" is a dead end, and this app has exactly one user who has
 * to get from an empty database to a first booking on their own.
 */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
