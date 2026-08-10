import Link from "next/link"
import { auth } from "@/auth"
import { Badge, Card, Empty, Stat, statusTone } from "@/components/bits"
import { Shell } from "@/components/shell"
import { deskSummary, listBookings, listRequests } from "@/db/queries"
import { segmentLabel, vehicleKindLabel } from "@/lib/catalog"
import { departureLabel, formatRange } from "@/lib/dates"
import { formatInr } from "@/lib/money"

// Reads the session cookie and the database, so there is nothing to prerender.
export const dynamic = "force-dynamic"

/**
 * The number of verified vehicles in one city before a demand-side push is
 * worth making. Not a setting: it is the launch rule, and a rule that can be
 * turned down is not a rule.
 */
const SUPPLY_TARGET = 40

export default async function DeskPage() {
  const session = await auth()
  const [summary, open, bookings] = await Promise.all([
    deskSummary(),
    listRequests("open"),
    listBookings(),
  ])

  const upcoming = bookings.filter((row) => row.booking.status === "confirmed").slice(0, 5)
  const supplyShare = Math.min(100, Math.round((summary.verifiedVehicles / SUPPLY_TARGET) * 100))

  return (
    <Shell email={session?.user?.email}>
      <div className="page-head">
        <div>
          <h1>The desk</h1>
          <p className="lede">
            Requirements in, structured quotes back, one awarded. Every number below is landed
            cost — what the group actually pays, not the opening line on the phone.
          </p>
        </div>
        <Link href="/requests/new" className="button-link">
          New requirement
        </Link>
      </div>

      <div className="stats">
        <Stat label="Open requirements" value={String(summary.openRequests)} />
        <Stat label="Quotes awaiting a decision" value={String(summary.quotesIn)} />
        <Stat
          label="Verified vehicles"
          value={String(summary.verifiedVehicles)}
          note={`across ${summary.operatorCount} operator${summary.operatorCount === 1 ? "" : "s"}`}
        />
        <Stat
          label="Booked"
          value={formatInr(summary.bookedValuePaise)}
          note={`${summary.confirmedBookings} trip${
            summary.confirmedBookings === 1 ? "" : "s"
          } · ${formatInr(summary.commissionPaise)} commission`}
        />
      </div>

      {summary.verifiedVehicles < SUPPLY_TARGET ? (
        <Card title="Supply comes first">
          <p className="muted">
            {summary.verifiedVehicles} of {SUPPLY_TARGET} verified vehicles signed in your launch
            city. Below that, a requirement is likely to go out to nobody who can answer it.
          </p>
          <div
            className="meter"
            role="progressbar"
            aria-valuenow={summary.verifiedVehicles}
            aria-valuemin={0}
            aria-valuemax={SUPPLY_TARGET}
            aria-label="Verified vehicles against the launch target"
          >
            <span className="meter-fill" style={{ width: `${supplyShare}%` }} />
          </div>
          <p>
            <Link href="/operators">Sign an operator →</Link>
          </p>
        </Card>
      ) : null}

      <Card
        title="Open requirements"
        action={<Link href="/requests">All requirements →</Link>}
      >
        {open.length === 0 ? (
          <Empty>
            Nothing open. <Link href="/requests/new">Post a requirement</Link> when the next
            wedding, offsite or yatra calls.
          </Empty>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Group</th>
                <th>Dates</th>
                <th>Vehicle</th>
                <th className="num">Quotes</th>
                <th>Departs</th>
              </tr>
            </thead>
            <tbody>
              {open.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link href={`/requests/${request.id}`}>#{request.reference}</Link>
                  </td>
                  <td>
                    {request.customerName}
                    <span className="sub">
                      {segmentLabel(request.segment)} · {request.passengers} people
                    </span>
                  </td>
                  <td>
                    {formatRange(request.startDate, request.endDate)}
                    <span className="sub">from {request.fromCity}</span>
                  </td>
                  <td>
                    {request.vehiclesNeeded}× {vehicleKindLabel(request.vehicleKind)}
                  </td>
                  <td className="num">
                    {request.quoteCount === 0 ? (
                      <Badge tone="muted">none yet</Badge>
                    ) : (
                      request.quoteCount
                    )}
                  </td>
                  <td>{departureLabel(request.startDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Confirmed trips" action={<Link href="/bookings">All bookings →</Link>}>
        {upcoming.length === 0 ? (
          <Empty>No trips awarded yet.</Empty>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Operator</th>
                <th>Dates</th>
                <th className="num">All-in</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((row) => (
                <tr key={row.booking.id}>
                  <td>
                    <Link href={`/requests/${row.request.id}`}>#{row.request.reference}</Link>
                  </td>
                  <td>
                    {row.operatorName}
                    <span className="sub">{row.operatorPhone}</span>
                  </td>
                  <td>{formatRange(row.request.startDate, row.request.endDate)}</td>
                  <td className="num">{formatInr(row.booking.allInPaise)}</td>
                  <td>
                    <Badge tone={statusTone(row.booking.status)}>{row.booking.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Shell>
  )
}
