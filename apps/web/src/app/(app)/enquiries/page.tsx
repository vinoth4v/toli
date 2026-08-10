import Link from "next/link"
import { Empty, EnquiryBadge, ErrorBanner, PageHead } from "@/components/ui"
import { listEnquiries, OPEN_ENQUIRY_STATUSES } from "@/db/enquiries"
import { formatIst, relativeDays } from "@/domain/datetime"
import { TRIP_TYPE_LABELS } from "@/domain/pricing"
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/domain/status"
import { vehicleClassLabel } from "@/domain/vehicles"

export const dynamic = "force-dynamic"

function parseStatus(value: string | undefined): EnquiryStatus | undefined {
  return ENQUIRY_STATUSES.find((status) => status === value)
}

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>
}) {
  const { status, error } = await searchParams
  const filter = parseStatus(status)
  // No filter means the ones still worth working, not everything ever taken.
  const rows = await listEnquiries(filter ? [filter] : OPEN_ENQUIRY_STATUSES)

  return (
    <main>
      <PageHead title="Enquiries" subtitle="Groups that want a vehicle.">
        <Link href="/enquiries/new">
          <button type="button">Take an enquiry</button>
        </Link>
      </PageHead>

      <ErrorBanner message={error} />

      <nav className="actions filters">
        <Link href="/enquiries">{filter ? "Open" : <strong>Open</strong>}</Link>
        {ENQUIRY_STATUSES.map((value) => (
          <Link key={value} href={`/enquiries?status=${value}`}>
            {filter === value ? <strong>{value}</strong> : value}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty>
          Nothing here. <Link href="/enquiries/new">Take one</Link>.
        </Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Customer</th>
                <th>Trip</th>
                <th>Leaves</th>
                <th>Wants</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link className="mono" href={`/enquiries/${row.id}`}>
                      {row.ref}
                    </Link>
                  </td>
                  <td>
                    {row.customerName}
                    <div className="small muted mono">{row.customerPhone}</div>
                  </td>
                  <td>
                    {row.origin} → {row.destination}
                    <div className="small muted">
                      {TRIP_TYPE_LABELS[row.tripType]} · {row.estimatedKm} km · {row.days}{" "}
                      {row.days === 1 ? "day" : "days"}
                    </div>
                  </td>
                  <td>
                    {formatIst(row.startAt)}
                    <div className="small muted">{relativeDays(row.startAt)}</div>
                  </td>
                  <td>
                    {vehicleClassLabel(row.vehicleClass)}
                    <div className="small muted">{row.passengers} passengers</div>
                  </td>
                  <td>
                    <EnquiryBadge status={row.status} />
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
