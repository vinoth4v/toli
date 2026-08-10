import Link from "next/link"
import { Badge, Card, Empty, PageHead, StatusBadge } from "@/components/ui"
import { getSettings } from "@/data/settings"
import { listOperators } from "@/data/supply"
import { maskPhone } from "@/domain/format"
import { formatBps } from "@/domain/money"

export const dynamic = "force-dynamic"

export default async function OperatorsPage() {
  const [operators, settings] = await Promise.all([listOperators(), getSettings()])

  return (
    <>
      <PageHead
        title="Operators"
        intro="Thirty responsive operators beat three hundred dormant ones. This list is supply, not a vanity count."
        actions={
          <Link href="/operators/new">
            <button type="button">Sign an operator</button>
          </Link>
        }
      />

      <Card>
        {operators.length === 0 ? (
          <Empty>
            No operators yet. <Link href="/operators/new">Sign the first one</Link> — Phase 0 is
            25–40 vehicles across 8–12 operators, on paper, with a rate card each.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>City</th>
                  <th>Contact</th>
                  <th className="right">Vehicles</th>
                  <th>Commission</th>
                  <th>Tier</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.id}>
                    <td>
                      <Link href={`/operators/${operator.id}`}>{operator.name}</Link>
                      {operator.leakageFlagged ? (
                        <div>
                          <Badge tone="stop">leakage watch</Badge>
                        </div>
                      ) : null}
                    </td>
                    <td>{operator.city}</td>
                    <td>
                      {operator.contactName}
                      <div className="muted small">{maskPhone(operator.phone)}</div>
                    </td>
                    <td className="right">
                      {operator.activeVehicleCount} / {operator.vehicleCount}
                    </td>
                    <td>
                      {operator.commissionBps === null ? (
                        <span className="muted">
                          {formatBps(settings.defaultCommissionBps)} (platform)
                        </span>
                      ) : (
                        formatBps(operator.commissionBps)
                      )}
                    </td>
                    <td>{operator.tier}</td>
                    <td>
                      <StatusBadge status={operator.status} />
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
