import Link from "next/link"
import { BookingBadge, Empty, Money, PageHead, Stat } from "@/components/ui"
import { listOverdueBookings, loadDashboard } from "@/db/dashboard"
import { formatIst, relativeDays } from "@/domain/datetime"
import { formatInr } from "@/domain/money"
import { TRIP_TYPE_LABELS } from "@/domain/pricing"

export const dynamic = "force-dynamic"

/**
 * The charter desk.
 *
 * Ordered by what goes wrong if it is missed: a vehicle leaving tomorrow with
 * no driver assigned beats a fortnight-old enquiry, and both beat the totals.
 */
export default async function DashboardPage() {
  const [dashboard, overdue] = await Promise.all([loadDashboard(), listOverdueBookings()])

  return (
    <main>
      <PageHead title="Charter desk" subtitle="Every group, every vehicle, every rupee.">
        <Link href="/enquiries/new">
          <button type="button">Take an enquiry</button>
        </Link>
      </PageHead>

      <ul className="stats">
        <Stat label="Open enquiries" value={String(dashboard.openEnquiries)} />
        <Stat label="Quotes awaiting a reply" value={String(dashboard.quotesAwaitingReply)} />
        <Stat label="Live bookings" value={String(dashboard.liveBookings)} />
        <Stat label="Booked, tax included" value={formatInr(dashboard.gmvPaise)} hint="GMV" />
        <Stat label="Our commission" value={formatInr(dashboard.commissionPaise)} />
        <Stat
          label="Verified operators"
          value={String(dashboard.verifiedOperators)}
          hint={`${dashboard.activeVehicles} vehicles listed`}
        />
      </ul>

      {overdue.length > 0 ? (
        <section className="card">
          <h2>Needs closing out</h2>
          <p className="muted small">
            These trips have already started or finished and are still open. Mark them completed so
            the operator can be settled.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Trip</th>
                  <th>Departed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((row) => (
                  <tr key={row.booking.id}>
                    <td>
                      <Link className="mono" href={`/bookings/${row.booking.id}`}>
                        {row.booking.ref}
                      </Link>
                    </td>
                    <td>
                      {row.enquiry.origin} → {row.enquiry.destination}
                    </td>
                    <td className="small muted">{relativeDays(row.enquiry.startAt)}</td>
                    <td>
                      <BookingBadge status={row.booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2>Next departures</h2>
        {dashboard.upcoming.length === 0 ? (
          <Empty>
            Nothing is due to leave. <Link href="/enquiries">Work the enquiries</Link> to change
            that.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Trip</th>
                  <th>Leaves</th>
                  <th>Operator</th>
                  <th>Driver</th>
                  <th className="right">Fare</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.upcoming.map((row) => (
                  <tr key={row.booking.id}>
                    <td>
                      <Link className="mono" href={`/bookings/${row.booking.id}`}>
                        {row.booking.ref}
                      </Link>
                      <div className="small muted">{TRIP_TYPE_LABELS[row.enquiry.tripType]}</div>
                    </td>
                    <td>
                      {row.enquiry.origin} → {row.enquiry.destination}
                      <div className="small muted">
                        {row.enquiry.passengers} passengers · {row.enquiry.customerName}
                      </div>
                    </td>
                    <td>
                      {formatIst(row.enquiry.startAt)}
                      <div className="small muted">{relativeDays(row.enquiry.startAt)}</div>
                    </td>
                    <td>{row.operator.name}</td>
                    <td>
                      {row.booking.driverName ? (
                        <>
                          {row.booking.driverName}
                          <div className="small muted mono">{row.booking.driverPhone}</div>
                        </>
                      ) : (
                        <span className="small muted">not assigned</span>
                      )}
                    </td>
                    <td className="right">
                      <Money paise={row.quote.totalPaise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
