import { notFound } from "next/navigation"
import {
  addVehicleAction,
  setVehicleActiveAction,
  setVerifiedAction,
} from "@/app/operators/actions"
import { auth } from "@/auth"
import { Badge, Card, Empty, Stat } from "@/components/bits"
import { Shell } from "@/components/shell"
import { getOperator } from "@/db/queries"
import { VEHICLE_KINDS, vehicleKindLabel } from "@/lib/catalog"

export const dynamic = "force-dynamic"

export default async function OperatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, { error }, session] = await Promise.all([params, searchParams, auth()])

  const operator = await getOperator(id)
  if (!operator) notFound()

  const active = operator.vehicles.filter((vehicle) => vehicle.active)
  const seats = active.reduce((total, vehicle) => total + vehicle.seats, 0)

  return (
    <Shell email={session?.user?.email}>
      <div className="page-head">
        <div>
          <h1>
            {operator.name}{" "}
            {operator.verified ? (
              <Badge tone="success">verified</Badge>
            ) : (
              <Badge tone="muted">unverified</Badge>
            )}
          </h1>
          <p className="lede">
            {operator.contactName ? `${operator.contactName} · ` : ""}
            {operator.phone} · {operator.city}
            {operator.gstin ? ` · GSTIN ${operator.gstin}` : ""}
          </p>
        </div>
        <form action={setVerifiedAction}>
          <input type="hidden" name="operatorId" value={operator.id} />
          <input type="hidden" name="verified" value={operator.verified ? "false" : "true"} />
          <button type="submit" className="ghost">
            {operator.verified ? "Withdraw verification" : "Mark verified"}
          </button>
        </form>
      </div>

      {error ? <p role="alert">That vehicle could not be saved — check the seats and the registration.</p> : null}

      <div className="stats">
        <Stat label="Vehicles on the road" value={String(active.length)} note={`${operator.vehicles.length} in total`} />
        <Stat label="Seats available" value={String(seats)} />
        <Stat label="Toli commission" value={`${(operator.commissionBps / 100).toFixed(0)}%`} note="settled at T+2" />
      </div>

      {operator.notes ? (
        <Card title="Notes">
          <p className="wrap">{operator.notes}</p>
        </Card>
      ) : null}

      <Card title="Fleet">
        {operator.vehicles.length === 0 ? (
          <Empty>No vehicles yet. Add the first below — an operator with none is never matched.</Empty>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Class</th>
                <th className="num">Seats</th>
                <th>Year</th>
                <th>AC</th>
                <th>On the road</th>
              </tr>
            </thead>
            <tbody>
              {operator.vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.registration}</td>
                  <td>{vehicleKindLabel(vehicle.kind)}</td>
                  <td className="num">{vehicle.seats}</td>
                  <td>{vehicle.modelYear ?? "—"}</td>
                  <td>{vehicle.ac ? "AC" : "Non-AC"}</td>
                  <td>
                    <form action={setVehicleActiveAction}>
                      <input type="hidden" name="vehicleId" value={vehicle.id} />
                      <input type="hidden" name="operatorId" value={operator.id} />
                      <input type="hidden" name="active" value={vehicle.active ? "false" : "true"} />
                      <button type="submit" className="ghost">
                        {vehicle.active ? "Take off the road" : "Put back on"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Add a vehicle">
        <form action={addVehicleAction} className="form-grid">
          <input type="hidden" name="operatorId" value={operator.id} />
          <fieldset>
            <legend>The vehicle</legend>
            <label htmlFor="registration">Registration</label>
            <input id="registration" name="registration" placeholder="RJ14 AB 1234" required />

            <label htmlFor="kind">Class</label>
            <select id="kind" name="kind" defaultValue="tempo_traveller" required>
              {VEHICLE_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>

            <label htmlFor="seats">Seats</label>
            <input id="seats" name="seats" inputMode="numeric" required />

            <label htmlFor="modelYear">Model year (optional)</label>
            <input id="modelYear" name="modelYear" inputMode="numeric" />

            <label className="check">
              <input type="checkbox" name="ac" defaultChecked /> Air conditioned
            </label>
          </fieldset>

          <div className="form-actions">
            <button type="submit">Add the vehicle</button>
          </div>
        </form>
      </Card>
    </Shell>
  )
}
