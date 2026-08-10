import Link from "next/link"
import { BookingBadge, Empty, ErrorBanner, Money, PageHead } from "@/components/ui"
import { listBookings } from "@/db/bookings"
import { formatIst, relativeDays } from "@/domain/datetime"
import { BOOKING_STATUSES, type BookingStatus } from "@/domain/status"

export const dynamic = "force-dynamic"

function parseStatus(value: string | undefined): BookingStatus | undefined {
  return BOOKING_STATUSES.find((status) => status === value)
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>
}) {
  const { status, error } = await searchParams
  const filter = parseStatus(status)
  // Default to the trips that still need something done to them.
  const rows = await listBookings(filter ? [filter] : ["confirmed", "on_trip"])

  return (
    <main>
      <PageHead title="Bookings" subtitle="Confirmed trips, in departure order." />

      <ErrorBanner message={error} />

      <nav className="actions filters">
        <Link href="/bookings">{filter ? "Live" : <strong>Live</strong>}</Link>
        {BOOKING_STATUSES.map((value) => (
          <Link key={value} href={`/bookings?status=${value}`}>
            {filter === value ? <strong>{value}</strong> : value}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty>
          Nothing booked. A booking appears when a customer accepts a quote on an{" "}
          <Link href="/enquiries">enquiry</Link>.
        </Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Trip</th>
                <th>Leaves</th>
                <th>Operator</th>
                <th>Driver</th>
                <th className="right">Fare</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.booking.id}>
                  <td>
                    <Link className="mono" href={`/bookings/${row.booking.id}`}>
                      {row.booking.ref}
                    </Link>
                  </td>
                  <td>
                    {row.enquiry.origin} → {row.enquiry.destination}
                    <div className="small muted">
                      {row.enquiry.customerName} · {row.enquiry.passengers} passengers
                    </div>
                  </td>
                  <td>
                    {formatIst(row.enquiry.startAt)}
                    <div className="small muted">{relativeDays(row.enquiry.startAt)}</div>
                  </td>
                  <td>{row.operator.name}</td>
                  <td className="small">
                    {row.booking.driverName ?? <span className="muted">not assigned</span>}
                  </td>
                  <td className="right">
                    <Money paise={row.quote.totalPaise} />
                  </td>
                  <td>
                    <BookingBadge status={row.booking.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
