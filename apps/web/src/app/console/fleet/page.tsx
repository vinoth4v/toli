import Link from "next/link"
import { Badge, Card, Empty, PageHead, StatusBadge } from "@/components/ui"
import { listVehicles } from "@/data/supply"
import { allowedTransitions, vehicleClassLabel } from "@/domain/vehicle"
import { setVehicleStatusAction } from "../operators/actions"

/**
 * Every vehicle on the platform and whether it may carry passengers today.
 *
 * The verdict is recomputed from documents on each load rather than read from
 * a column, because it changes at midnight on its own.
 */

export const dynamic = "force-dynamic"

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, vehicles] = await Promise.all([searchParams, listVehicles()])
  const blocked = vehicles.filter((row) => row.status === "active" && !row.compliance.fitForService)

  return (
    <>
      <PageHead
        title="Fleet"
        intro="Vehicles, judged against their own paperwork. A vehicle that fails here cannot be assigned to a trip, whatever the season and however good the operator."
      />

      {error ? <p role="alert">{error}</p> : null}

      {blocked.length > 0 ? (
        <p className="notice">
          {blocked.length} active vehicle(s) now fail compliance and should be suspended. The
          assignment screen already refuses them — this is the paperwork catching up.
        </p>
      ) : null}

      <Card>
        {vehicles.length === 0 ? (
          <Empty>
            No vehicles yet. Add them from an <Link href="/console/operators">operator</Link>.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Operator</th>
                  <th>Class</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Fitness</th>
                  <th>Change status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="numeric">{vehicle.registrationNumber}</td>
                    <td>
                      <Link href={`/console/operators/${vehicle.operatorId}`}>
                        {vehicle.operatorName}
                      </Link>
                    </td>
                    <td>
                      {vehicleClassLabel(vehicle.vehicleClass)}
                      <div className="muted small">
                        {vehicle.seats} seats · {vehicle.ac ? "AC" : "non-AC"}
                      </div>
                    </td>
                    <td>{vehicle.yearOfManufacture}</td>
                    <td>
                      <StatusBadge status={vehicle.status} />
                      {vehicle.suspensionReason ? (
                        <div className="muted small">{vehicle.suspensionReason}</div>
                      ) : null}
                    </td>
                    <td>
                      {vehicle.compliance.fitForService ? (
                        vehicle.compliance.fitForInterstate ? (
                          <Badge tone="ok">interstate ready</Badge>
                        ) : (
                          <Badge tone="warn">in-state only</Badge>
                        )
                      ) : (
                        <Badge tone="stop">blocked</Badge>
                      )}
                      {vehicle.compliance.problems.length > 0 ? (
                        <ul className="muted small">
                          {vehicle.compliance.problems.slice(0, 3).map((problem) => (
                            <li key={problem.message}>{problem.message}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td>
                      {allowedTransitions(vehicle.status).length === 0 ? (
                        <span className="muted small">—</span>
                      ) : (
                        <form action={setVehicleStatusAction} className="inline-form">
                          <input type="hidden" name="vehicleId" value={vehicle.id} />
                          <input type="hidden" name="from" value={vehicle.status} />
                          <select name="to" aria-label="New status">
                            {allowedTransitions(vehicle.status).map((status) => (
                              <option key={status} value={status}>
                                {status.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                          <input
                            name="reason"
                            placeholder="reason"
                            defaultValue={vehicle.compliance.suspensionReason ?? ""}
                            aria-label="Reason"
                          />
                          <button type="submit" className="quiet">
                            Apply
                          </button>
                        </form>
                      )}
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
