import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { operatorEarnings } from "@/data/scoped"
import { formatIst } from "@/domain/format"
import { formatPaise } from "@/domain/money"

/**
 * What the operator is paid, with every deduction named.
 *
 * §7.4's pitch is that agents take 15–25% and Toli takes 8–12% *and says so*.
 * A screen that showed a net figure without its arithmetic would throw that
 * away — the transparency is the product. Commission, TCS and TDS each get
 * their own line, and so does the cash the driver already collected, which is
 * the number operators most often think has gone missing.
 */

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  pending: "Held until the trip is done",
  released: "Released — payout on its way",
  paid: "Paid",
}

export default async function PartnerEarnings() {
  const session = await auth()
  const operatorId = session?.user.operatorId
  if (!operatorId) redirect("/login")

  const rows = await operatorEarnings(operatorId)
  const settled = rows.filter((row) => row.settlement !== null)

  const paid = settled
    .filter((row) => row.settlement?.status === "paid")
    .reduce((total, row) => total + (row.settlement?.netPayablePaise ?? 0), 0)
  const awaiting = settled
    .filter((row) => row.settlement?.status !== "paid")
    .reduce((total, row) => total + (row.settlement?.netPayablePaise ?? 0), 0)
  const gross = rows.reduce((total, row) => total + row.booking.agreedTotalPaise, 0)

  return (
    <>
      <header className="partner-head">
        <div>
          <h1>Earnings</h1>
          <p className="muted small">
            Every deduction is a line you can check. Nothing is netted off silently.
          </p>
        </div>
        <dl className="partner-stats">
          <div>
            <dt>Trips</dt>
            <dd>{rows.length}</dd>
          </div>
          <div>
            <dt>Booked value</dt>
            <dd className="numeric">{formatPaise(gross)}</dd>
          </div>
          <div>
            <dt>Awaiting payout</dt>
            <dd className="numeric">{formatPaise(awaiting)}</dd>
          </div>
          <div>
            <dt>Paid to date</dt>
            <dd className="numeric">{formatPaise(paid)}</dd>
          </div>
        </dl>
      </header>

      {rows.length === 0 ? (
        <p className="muted">No confirmed trips yet.</p>
      ) : (
        <div className="earning-list">
          {rows.map(({ booking, request, settlement, customerName }) => (
            <article key={booking.id} className="earning">
              <header>
                <div>
                  <h3>
                    {request.city} · {formatIst(request.startAt)}
                  </h3>
                  <p className="muted small">
                    {booking.reference} · {customerName}
                  </p>
                </div>
                <span className={`state ${settlement?.status === "paid" ? "good" : "quiet"}`}>
                  {settlement ? STATUS_LABEL[settlement.status] : "Trip not settled yet"}
                </span>
              </header>

              {settlement ? (
                <table className="settle-table">
                  <tbody>
                    <tr>
                      <td>Trip value</td>
                      <td>{formatPaise(settlement.grossPaise)}</td>
                    </tr>
                    <tr>
                      <td>Toli commission</td>
                      <td>−{formatPaise(settlement.commissionPaise)}</td>
                    </tr>
                    <tr>
                      <td>
                        TCS
                        <div className="muted small">s.52 CGST, deposited for you</div>
                      </td>
                      <td>−{formatPaise(settlement.tcsPaise)}</td>
                    </tr>
                    <tr>
                      <td>
                        TDS
                        <div className="muted small">s.194-O, certificate issued</div>
                      </td>
                      <td>−{formatPaise(settlement.tdsPaise)}</td>
                    </tr>
                    {settlement.expensesReimbursedPaise > 0 ? (
                      <tr>
                        <td>Road expenses you paid</td>
                        <td>+{formatPaise(settlement.expensesReimbursedPaise)}</td>
                      </tr>
                    ) : null}
                    {settlement.cashCollectedPaise > 0 ? (
                      <tr>
                        <td>
                          Cash your driver collected
                          <div className="muted small">already with you</div>
                        </td>
                        <td>−{formatPaise(settlement.cashCollectedPaise)}</td>
                      </tr>
                    ) : null}
                    <tr className="total">
                      <td>Transferred to you</td>
                      <td>{formatPaise(settlement.netPayablePaise)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="muted small">
                  Trip value {formatPaise(booking.agreedTotalPaise)}. The statement appears once the
                  trip is completed.
                </p>
              )}

              {settlement?.utr ? <p className="muted small numeric">UTR {settlement.utr}</p> : null}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
