import Link from "next/link"
import { Empty, ErrorBanner, OperatorBadge, PageHead } from "@/components/ui"
import { listOperators } from "@/db/operators"
import { formatBps } from "@/domain/money"
import { createOperatorAction } from "./actions.ts"

export const dynamic = "force-dynamic"

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const operators = await listOperators()

  return (
    <main>
      <PageHead
        title="Operators"
        subtitle="The transport companies whose vehicles this desk charters."
      />

      <ErrorBanner message={error} />

      {operators.length === 0 ? (
        <Empty>No operators yet. Add the first one below.</Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>City</th>
                <th>Contact</th>
                <th>GSTIN</th>
                <th>Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => (
                <tr key={operator.id}>
                  <td>
                    <Link href={`/operators/${operator.id}`}>{operator.name}</Link>
                  </td>
                  <td>{operator.city}</td>
                  <td>
                    {operator.contactName}
                    <div className="small muted mono">{operator.phone}</div>
                  </td>
                  <td className="small mono">{operator.gstin ?? "—"}</td>
                  <td>{formatBps(operator.commissionBps)}</td>
                  <td>
                    <OperatorBadge status={operator.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="card">
        <h2>Add an operator</h2>
        <p className="small muted">
          New operators start unverified. Verification is the thing this marketplace actually sells,
          so nothing they own can be quoted until someone has checked their papers.
        </p>
        <form action={createOperatorAction}>
          <div className="form-grid">
            <div>
              <label htmlFor="name">Company</label>
              <input id="name" name="name" required />
            </div>
            <div>
              <label htmlFor="city">City</label>
              <input id="city" name="city" required />
            </div>
            <div>
              <label htmlFor="contactName">Contact</label>
              <input id="contactName" name="contactName" required />
            </div>
            <div>
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" inputMode="tel" required />
            </div>
            <div>
              <label htmlFor="gstin">GSTIN</label>
              <input id="gstin" name="gstin" placeholder="33AAAAA0000A1Z5" />
              <span className="hint">Optional now, required before they can be settled.</span>
            </div>
            <div>
              <label htmlFor="commissionPercent">Commission (%)</label>
              <input
                id="commissionPercent"
                name="commissionPercent"
                type="number"
                min="0"
                max="50"
                step="0.5"
                defaultValue="12"
              />
            </div>
            <div className="field-wide">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                placeholder="Fleet, routes they know, who referred them…"
              />
            </div>
          </div>
          <button type="submit">Add operator</button>
        </form>
      </section>
    </main>
  )
}
