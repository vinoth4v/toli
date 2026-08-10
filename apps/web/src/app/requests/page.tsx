import Link from "next/link"
import { auth } from "@/auth"
import { Badge, Card, Empty, statusTone } from "@/components/bits"
import { Shell } from "@/components/shell"
import { listRequests } from "@/db/queries"
import { segmentLabel, vehicleKindLabel } from "@/lib/catalog"
import { formatRange } from "@/lib/dates"

export const dynamic = "force-dynamic"

export default async function RequestsPage() {
  const session = await auth()
  const requests = await listRequests()

  return (
    <Shell email={session?.user?.email}>
      <div className="page-head">
        <div>
          <h1>Requirements</h1>
          <p className="lede">Every charter requirement the desk has taken, newest first.</p>
        </div>
        <Link href="/requests/new" className="button-link">
          New requirement
        </Link>
      </div>

      <Card>
        {requests.length === 0 ? (
          <Empty>
            Nothing yet. <Link href="/requests/new">Post the first requirement</Link>.
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
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
                  <td className="num">{request.quoteCount}</td>
                  <td>
                    <Badge tone={statusTone(request.status)}>{request.status}</Badge>
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
