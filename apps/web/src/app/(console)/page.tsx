import Link from "next/link"
import { Amount, Card, Empty, PageHead, StatusBadge, Tile } from "@/components/ui"
import { loadDashboard } from "@/data/dashboard"
import { formatIst, relativeToNow } from "@/domain/format"
import { formatRate } from "@/domain/metrics"

/**
 * The control tower of §4.4 — every live trip and every stuck RFQ on one
 * screen — with §13's metrics above it.
 *
 * The order is deliberate. Quote response rate comes first because the plan
 * says it is *the* metric: below 50%, nothing else on this page matters. GMV
 * comes last, because a marketplace that celebrates revenue while its response
 * rate rots is one that finds out too late.
 */

export const dynamic = "force-dynamic"

export default async function ControlTowerPage() {
  const { health, trust, money, attention } = await loadDashboard()

  return (
    <>
      <PageHead
        title="Control tower"
        intro="The last 30 days of marketplace health, and everything waiting on the ops desk right now."
        actions={
          <Link href="/rfqs/new">
            <button type="button">New RFQ</button>
          </Link>
        }
      />

      <h2>Marketplace health</h2>
      <dl className="tiles">
        <Tile
          label="Quote response rate"
          value={formatRate(health.responseRate)}
          target="≥3 quotes within 30 min · target 60%"
          tone={health.requests === 0 ? undefined : health.responseRate >= 0.5 ? "good" : "bad"}
        />
        <Tile
          label="Time to first quote"
          value={
            health.medianMinutesToFirstQuote === null
              ? "—"
              : `${Math.round(health.medianMinutesToFirstQuote)} min`
          }
          target="median · target under 10 min"
        />
        <Tile label="RFQ → booking" value={formatRate(health.conversionRate)} target="target 25%" />
        <Tile
          label="RFQs"
          value={health.requests}
          target={`${health.unquoted} with no quote yet`}
        />
      </dl>

      <h2>Operational trust</h2>
      <dl className="tiles">
        <Tile
          label="On-time arrival"
          value={formatRate(trust.onTimeRate)}
          target="within 15 min · target 95%"
          tone={trust.onTimeRate === null ? undefined : trust.onTimeRate >= 0.95 ? "good" : "bad"}
        />
        <Tile
          label="Operator cancellations"
          value={formatRate(trust.operatorCancellationRate)}
          target="target under 2%"
        />
        <Tile label="Trips" value={trust.trips} target="booked in the last 30 days" />
        <Tile
          label="Compliance queue"
          value={attention.complianceItems}
          target={`${attention.blockingComplianceItems} blocking`}
          tone={attention.blockingComplianceItems > 0 ? "bad" : undefined}
        />
      </dl>

      <h2>Money</h2>
      <dl className="tiles">
        <Tile label="GMV" value={<Amount paise={money.gmvPaise} />} target="last 30 days" />
        <Tile
          label="Commission"
          value={<Amount paise={money.commissionPaise} />}
          target="earned on booked trips"
        />
        <Tile
          label="Average booking"
          value={<Amount paise={money.averageBookingPaise} />}
          target={`${money.bookings} bookings`}
        />
        <Tile
          label="Awaiting settlement"
          value={<Amount paise={attention.settlementsPendingPaise} />}
          target={`${attention.settlementsPending} operators`}
        />
      </dl>

      <div className="split">
        <div>
          <Card title="Live and departing this week">
            {attention.live.length === 0 ? (
              <Empty>No trips out or due in the next seven days.</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Booking</th>
                      <th>Operator</th>
                      <th>Departs</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.live.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link href={`/bookings/${row.id}`}>{row.reference}</Link>
                        </td>
                        <td>{row.operatorName}</td>
                        <td>
                          {formatIst(row.startAt)}
                          <div className="muted small">{relativeToNow(row.startAt)}</div>
                        </td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Quotes in, decision out">
            {attention.awaitingDecision.length === 0 ? (
              <Empty>Nothing waiting on a decision.</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>RFQ</th>
                      <th className="right">Quotes</th>
                      <th>Departs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.awaitingDecision.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link href={`/rfqs/${row.id}`}>{row.reference}</Link>
                        </td>
                        <td className="right">{row.quotes}</td>
                        <td>{formatIst(row.startAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="No quotes yet">
            {attention.unquoted.length === 0 ? (
              <Empty>Every open RFQ has at least one quote.</Empty>
            ) : (
              <ul className="timeline">
                {attention.unquoted.map((row) => (
                  <li key={row.id}>
                    <Link href={`/rfqs/${row.id}`}>{row.reference}</Link> · {row.customerName}
                    <time>
                      {row.city} · departs {formatIst(row.startAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Manual matching desk">
            <p className="muted small">
              For the first twelve months a person beats the algorithm on high-value RFQs. Open an
              RFQ, pick the operators worth asking, and record what comes back — the fan-out is
              logged either way, so the response-rate number above stays honest.
            </p>
            <Link href="/rfqs">
              <button type="button" className="quiet">
                Open the RFQ desk
              </button>
            </Link>
          </Card>
        </div>
      </div>
    </>
  )
}
