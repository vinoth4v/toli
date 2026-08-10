import Link from "next/link"
import { createOperatorAction } from "@/app/operators/actions"
import { auth } from "@/auth"
import { Badge, Card, Empty } from "@/components/bits"
import { Shell } from "@/components/shell"
import { listOperatorsWithVehicles } from "@/db/queries"
import { vehicleKindLabel } from "@/lib/catalog"

export const dynamic = "force-dynamic"

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [session, { error }] = await Promise.all([auth(), searchParams])
  const operators = await listOperatorsWithVehicles()

  return (
    <Shell email={session?.user?.email}>
      <div className="page-head">
        <div>
          <h1>Operators</h1>
          <p className="lede">
            The supply side: small fleet businesses, not gig drivers. What Toli sells them is the
            agent&rsquo;s cut back, payment at T+2 instead of T+90, and a dispatch tool that
            replaces the paper diary.
          </p>
        </div>
      </div>

      {error ? <p role="alert">That operator could not be saved — check the name, phone, city and commission.</p> : null}

      <Card title="Signed operators">
        {operators.length === 0 ? (
          <Empty>None yet. Sign the first one below — supply comes before demand.</Empty>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Operator</th>
                <th>City</th>
                <th>Fleet</th>
                <th className="num">Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => {
                const active = operator.vehicles.filter((vehicle) => vehicle.active)
                const largest = active[0]

                return (
                  <tr key={operator.id}>
                    <td>
                      <Link href={`/operators/${operator.id}`}>{operator.name}</Link>
                      <span className="sub">
                        {operator.contactName ? `${operator.contactName} · ` : ""}
                        {operator.phone}
                      </span>
                    </td>
                    <td>{operator.city}</td>
                    <td>
                      {active.length} vehicle{active.length === 1 ? "" : "s"}
                      {largest ? (
                        <span className="sub">
                          largest {vehicleKindLabel(largest.kind)}, {largest.seats} seats
                        </span>
                      ) : (
                        <span className="sub">none on the road</span>
                      )}
                    </td>
                    <td className="num">{(operator.commissionBps / 100).toFixed(0)}%</td>
                    <td>
                      {operator.verified ? (
                        <Badge tone="success">verified</Badge>
                      ) : (
                        <Badge tone="muted">unverified</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Sign an operator">
        <form action={createOperatorAction} className="form-grid">
          <fieldset>
            <legend>The business</legend>
            <label htmlFor="name">Business name</label>
            <input id="name" name="name" placeholder="Sharma Travels" required />

            <label htmlFor="contactName">Who you speak to (optional)</label>
            <input id="contactName" name="contactName" />

            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" inputMode="tel" required />

            <label htmlFor="city">Base city</label>
            <input id="city" name="city" placeholder="Jaipur" required />

            <label htmlFor="gstin">GSTIN (optional)</label>
            <input id="gstin" name="gstin" />
          </fieldset>

          <fieldset>
            <legend>The deal</legend>
            <label htmlFor="commissionPercent">Toli commission (%)</label>
            <input
              id="commissionPercent"
              name="commissionPercent"
              inputMode="numeric"
              defaultValue="10"
              required
            />

            <label className="check">
              <input type="checkbox" name="verified" /> Permit, fitness certificate and at least
              one vehicle seen
            </label>

            <label htmlFor="notes">Notes (optional)</label>
            <textarea id="notes" name="notes" rows={2} />
          </fieldset>

          <div className="form-actions">
            <button type="submit">Sign the operator</button>
          </div>
        </form>
      </Card>
    </Shell>
  )
}
