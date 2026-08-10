import Link from "next/link"
import { Card, Empty, PageHead, StatusBadge } from "@/components/ui"
import { listRequests } from "@/data/demand"
import { formatIst, maskPhone, relativeToNow } from "@/domain/format"
import { tripTypeLabel } from "@/domain/trip"
import { vehicleClassLabel } from "@/domain/vehicle"

export const dynamic = "force-dynamic"

export default async function RequestsPage() {
  const requests = await listRequests()

  return (
    <>
      <PageHead
        title="RFQ desk"
        intro="Every requirement a group has asked for, newest first. An RFQ becomes a booking when one of its structured quotes is accepted."
        actions={
          <Link href="/rfqs/new">
            <button type="button">New RFQ</button>
          </Link>
        }
      />

      <Card>
        {requests.length === 0 ? (
          <Empty>
            No RFQs yet. <Link href="/rfqs/new">Record the first one</Link> — the plan's Phase 0 is
            fifty real bookings taken by hand, and this is where they go.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Trip</th>
                  <th>Vehicle</th>
                  <th>Departs</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(({ request, customer }) => (
                  <tr key={request.id}>
                    <td>
                      <Link href={`/rfqs/${request.id}`}>{request.reference}</Link>
                      <div className="muted small">{relativeToNow(request.createdAt)}</div>
                    </td>
                    <td>
                      {customer.name}
                      <div className="muted small">{maskPhone(customer.phone)}</div>
                    </td>
                    <td>
                      {tripTypeLabel(request.tripType)}
                      <div className="muted small">
                        {request.city}
                        {request.interstate ? ` · crosses ${request.statesCrossed.join(", ")}` : ""}
                      </div>
                    </td>
                    <td>
                      {request.vehicleCount} × {vehicleClassLabel(request.vehicleClass)}
                      <div className="muted small">{request.passengerCount} passengers</div>
                    </td>
                    <td>{formatIst(request.startAt)}</td>
                    <td>
                      <StatusBadge status={request.status} />
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
