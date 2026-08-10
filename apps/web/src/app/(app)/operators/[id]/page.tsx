import { notFound } from "next/navigation"
import { Badge, Empty, ErrorBanner, Line, OperatorBadge, PageHead } from "@/components/ui"
import { getOperator, listVehicles } from "@/db/operators"
import { formatIstDate } from "@/domain/datetime"
import { formatBps, formatInrExact } from "@/domain/money"
import { canQuote } from "@/domain/status"
import { PERMIT_LABELS, PERMIT_TYPES, RATE_CARDS, VEHICLE_CLASSES } from "@/domain/vehicles"
import { createVehicleAction, setOperatorStatusAction, setVehicleActiveAction } from "../actions.ts"

export const dynamic = "force-dynamic"

/** A permit that has run out is the one thing here that must shout. */
function permitExpired(expiry: string | null): boolean {
  return expiry != null && new Date(`${expiry}T23:59:59+05:30`).getTime() < Date.now()
}

export default async function OperatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const operator = await getOperator(id)
  if (!operator) notFound()

  const vehicles = await listVehicles(operator.id)

  return (
    <main>
      <PageHead title={operator.name} subtitle={`${operator.city} · ${operator.contactName}`}>
        <OperatorBadge status={operator.status} />
        {operator.status === "verified" ? (
          <form action={setOperatorStatusAction}>
            <input type="hidden" name="operatorId" value={operator.id} />
            <input type="hidden" name="status" value="suspended" />
            <button className="danger" type="submit">
              Suspend
            </button>
          </form>
        ) : (
          <form action={setOperatorStatusAction}>
            <input type="hidden" name="operatorId" value={operator.id} />
            <input type="hidden" name="status" value="verified" />
            <button type="submit">Verify</button>
          </form>
        )}
      </PageHead>

      <ErrorBanner message={error} />

      {canQuote(operator.status) ? null : (
        <p role="alert">
          Nothing this operator owns can be quoted until they are verified.
        </p>
      )}

      <div className="columns">
        <section className="card">
          <h2>Company</h2>
          <dl className="lines">
            <Line label="Phone" value={operator.phone} />
            <Line label="GSTIN" value={operator.gstin ?? "not collected"} />
            <Line label="Commission" value={formatBps(operator.commissionBps)} />
            <Line label="Listed since" value={formatIstDate(operator.createdAt)} />
          </dl>
          {operator.notes ? <p className="small muted">{operator.notes}</p> : null}
        </section>

        <section className="card">
          <h2>List a vehicle</h2>
          <form action={createVehicleAction}>
            <input type="hidden" name="operatorId" value={operator.id} />
            <div className="form-grid">
              <div>
                <label htmlFor="registration">Registration</label>
                <input id="registration" name="registration" placeholder="TN 09 BW 1234" required />
              </div>
              <div>
                <label htmlFor="class">Class</label>
                <select id="class" name="class" defaultValue="tempo_traveller">
                  {VEHICLE_CLASSES.map((value) => (
                    <option key={value} value={value}>
                      {RATE_CARDS[value].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="seats">Seats</label>
                <input id="seats" name="seats" type="number" min="4" max="60" defaultValue="14" />
              </div>
              <div>
                <label htmlFor="model">Model</label>
                <input id="model" name="model" placeholder="Force Traveller 3350" />
              </div>
              <div>
                <label htmlFor="permitType">Permit</label>
                <select id="permitType" name="permitType" defaultValue="all_india_tourist">
                  {PERMIT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {PERMIT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="permitExpiry">Permit expires</label>
                <input id="permitExpiry" name="permitExpiry" type="date" />
              </div>
              <div>
                <label htmlFor="perKmRupees">Their rate (₹/km)</label>
                <input id="perKmRupees" name="perKmRupees" type="number" min="0" step="0.5" />
                <span className="hint">Leave blank to quote at the class rate.</span>
              </div>
              <div>
                <label htmlFor="ac">
                  <input id="ac" name="ac" type="checkbox" defaultChecked /> Air conditioned
                </label>
              </div>
            </div>
            <button type="submit">List vehicle</button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>Fleet</h2>
        {vehicles.length === 0 ? (
          <Empty>No vehicles listed. An operator with no vehicles cannot be quoted.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Class</th>
                  <th>Seats</th>
                  <th>Permit</th>
                  <th>Rate</th>
                  <th>Listed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="mono">{vehicle.registration}</td>
                    <td>
                      {RATE_CARDS[vehicle.class].label}
                      <div className="small muted">{vehicle.model ?? (vehicle.ac ? "AC" : "non-AC")}</div>
                    </td>
                    <td>{vehicle.seats}</td>
                    <td>
                      {PERMIT_LABELS[vehicle.permitType]}
                      <div className="small muted">
                        {vehicle.permitExpiry ? (
                          permitExpired(vehicle.permitExpiry) ? (
                            <Badge tone="danger">expired {vehicle.permitExpiry}</Badge>
                          ) : (
                            `to ${vehicle.permitExpiry}`
                          )
                        ) : (
                          "expiry not recorded"
                        )}
                      </div>
                    </td>
                    <td>
                      {`₹${formatInrExact(
                        vehicle.perKmPaise ?? RATE_CARDS[vehicle.class].perKmPaise,
                      )}/km`}
                      {vehicle.perKmPaise ? null : <div className="small muted">class rate</div>}
                    </td>
                    <td>
                      {vehicle.active ? (
                        <Badge tone="success">active</Badge>
                      ) : (
                        <Badge tone="neutral">off the road</Badge>
                      )}
                    </td>
                    <td>
                      <form action={setVehicleActiveAction}>
                        <input type="hidden" name="vehicleId" value={vehicle.id} />
                        <input type="hidden" name="operatorId" value={operator.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={vehicle.active ? "false" : "true"}
                        />
                        <button className="secondary" type="submit">
                          {vehicle.active ? "Take off" : "Put back"}
                        </button>
                      </form>
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
