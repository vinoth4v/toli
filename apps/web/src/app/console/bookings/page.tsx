import Link from "next/link"
import { Amount, Card, Empty, PageHead, StatusBadge } from "@/components/ui"
import { listBookings } from "@/data/fulfilment"
import { formatIst } from "@/domain/format"
import { vehicleClassLabel } from "@/domain/vehicle"

export const dynamic = "force-dynamic"

export default async function BookingsPage() {
  const bookings = await listBookings()

  return (
    <>
      <PageHead
        title="Bookings"
        intro="Confirmed trips, from advance payment to settlement. The agreed total is frozen at acceptance — a rate card edited next week cannot change what happened last Friday."
      />

      <Card>
        {bookings.length === 0 ? (
          <Empty>
            No bookings yet. Accept a quote on an <Link href="/console/rfqs">RFQ</Link> to create
            one.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Operator</th>
                  <th>Trip</th>
                  <th>Departs</th>
                  <th className="right">Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(({ booking, request, customer, operator }) => (
                  <tr key={booking.id}>
                    <td>
                      <Link href={`/console/bookings/${booking.id}`}>{booking.reference}</Link>
                    </td>
                    <td>{customer.name}</td>
                    <td>{operator.name}</td>
                    <td>
                      {request.city}
                      <div className="muted small">
                        {request.vehicleCount} × {vehicleClassLabel(request.vehicleClass)}
                      </div>
                    </td>
                    <td>{formatIst(request.startAt)}</td>
                    <td className="right">
                      <Amount paise={booking.agreedTotalPaise} />
                    </td>
                    <td>
                      <StatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
