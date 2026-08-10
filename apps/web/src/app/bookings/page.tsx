import Link from "next/link"
import { setBookingStatusAction } from "@/app/requests/actions"
import { auth } from "@/auth"
import { Badge, Card, Empty, Stat, statusTone } from "@/components/bits"
import { Shell } from "@/components/shell"
import { listBookings } from "@/db/queries"
import { formatRange } from "@/lib/dates"
import { formatInr } from "@/lib/money"

export const dynamic = "force-dynamic"

export default async function BookingsPage() {
  const session = await auth()
  const bookings = await listBookings()

  const confirmed = bookings.filter((row) => row.booking.status === "confirmed")
  const value = confirmed.reduce((total, row) => total + row.booking.allInPaise, 0)
  const commission = confirmed.reduce((total, row) => total + row.booking.commissionPaise, 0)
  const advance = confirmed.reduce((total, row) => total + row.booking.advancePaise, 0)

  return (
    <Shell email={session?.user?.email}>
      <div className="page-head">
        <div>
          <h1>Bookings</h1>
          <p className="lede">
            Awarded trips, with the numbers frozen at the moment of the award. Changing how
            pricing is calculated never restates one of these.
          </p>
        </div>
      </div>

      <div className="stats">
        <Stat label="Confirmed" value={String(confirmed.length)} />
        <Stat label="Booked value" value={formatInr(value)} />
        <Stat label="Advance collected" value={formatInr(advance)} />
        <Stat label="Toli commission" value={formatInr(commission)} />
      </div>

      <Card>
        {bookings.length === 0 ? (
          <Empty>
            Nothing awarded yet. Award a quote from a{" "}
            <Link href="/requests">requirement</Link>.
          </Empty>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Group</th>
                <th>Operator</th>
                <th>Dates</th>
                <th className="num">All-in</th>
                <th className="num">Advance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((row) => (
                <tr key={row.booking.id}>
                  <td>
                    <Link href={`/requests/${row.request.id}`}>#{row.request.reference}</Link>
                  </td>
                  <td>
                    {row.request.customerName}
                    <span className="sub">{row.request.customerPhone}</span>
                  </td>
                  <td>
                    {row.operatorName}
                    <span className="sub">{row.operatorPhone}</span>
                  </td>
                  <td>{formatRange(row.request.startDate, row.request.endDate)}</td>
                  <td className="num">{formatInr(row.booking.allInPaise)}</td>
                  <td className="num">{formatInr(row.booking.advancePaise)}</td>
                  <td>
                    <Badge tone={statusTone(row.booking.status)}>{row.booking.status}</Badge>
                    {row.booking.status === "confirmed" ? (
                      <div className="row-actions">
                        <form action={setBookingStatusAction}>
                          <input type="hidden" name="bookingId" value={row.booking.id} />
                          <input type="hidden" name="status" value="completed" />
                          <button type="submit" className="ghost">
                            Trip done
                          </button>
                        </form>
                        <form action={setBookingStatusAction}>
                          <input type="hidden" name="bookingId" value={row.booking.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <button type="submit" className="ghost">
                            Cancelled
                          </button>
                        </form>
                      </div>
                    ) : null}
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
