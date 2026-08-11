import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { operatorInbox } from "@/data/scoped"
import { formatIst, relativeToNow } from "@/domain/format"
import { formatPaise } from "@/domain/money"
import { tripTypeLabel } from "@/domain/trip"
import { vehicleClassLabel } from "@/domain/vehicle"

/**
 * The quote inbox.
 *
 * §13: quote response rate is *the* marketplace metric, and time-to-first-quote
 * is the operator's half of it. So the first thing on this screen is how long
 * each unanswered RFQ has been waiting, in plain words, sorted so the oldest
 * shouts loudest — and the answer button is one click away, not three.
 */

export const dynamic = "force-dynamic"

export default async function PartnerInbox() {
  const session = await auth()
  const operatorId = session?.user.operatorId
  if (!operatorId) redirect("/login")

  const inbox = await operatorInbox(operatorId)
  const waiting = inbox.filter((row) => row.quote.status === "requested")
  const answered = inbox.filter((row) => row.quote.status !== "requested")
  const won = answered.filter((row) => row.quote.status === "accepted")

  return (
    <>
      <header className="partner-head">
        <div>
          <h1>Quote inbox</h1>
          <p className="muted small">
            Answer fast and you get ranked higher. The customer sees every quote side by side, so
            the number that wins is the honest one, not the lowest-looking one.
          </p>
        </div>
        <dl className="partner-stats">
          <div>
            <dt>Waiting on you</dt>
            <dd className={waiting.length > 0 ? "urgent" : ""}>{waiting.length}</dd>
          </div>
          <div>
            <dt>Quoted</dt>
            <dd>{answered.length}</dd>
          </div>
          <div>
            <dt>Won</dt>
            <dd>{won.length}</dd>
          </div>
        </dl>
      </header>

      <section>
        <h2 className="partner-section">Needs a price</h2>
        {waiting.length === 0 ? (
          <p className="muted">Nothing waiting. New requests appear here the moment they arrive.</p>
        ) : (
          <ul className="rfq-list">
            {waiting.map(({ quote, request, customerName }) => (
              <li key={quote.id}>
                <Link href={`/partner/quotes/${quote.id}`}>
                  <span className="waiting-for">{relativeToNow(quote.requestedAt)}</span>
                  <span className="rfq-main">
                    <strong>
                      {request.city} · {tripTypeLabel(request.tripType)}
                    </strong>
                    <span className="muted small">
                      {request.passengerCount} passengers ·{" "}
                      {vehicleClassLabel(request.vehicleClass)} · leaves{" "}
                      {formatIst(request.startAt)}
                      {request.interstate ? ` · crosses ${request.statesCrossed.join(", ")}` : ""}
                    </span>
                    <span className="muted small">{customerName}</span>
                  </span>
                  <span className="rfq-go">Quote →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="partner-section">Already quoted</h2>
        {answered.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>Leaves</th>
                  <th className="right">You quoted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {answered.map(({ quote, request }) => (
                  <tr key={quote.id}>
                    <td>
                      {request.city} · {tripTypeLabel(request.tripType)}
                      <div className="muted small">
                        {request.passengerCount} passengers ·{" "}
                        {vehicleClassLabel(request.vehicleClass)}
                      </div>
                    </td>
                    <td>{formatIst(request.startAt)}</td>
                    <td className="right numeric">{formatPaise(quote.estimatedTotalPaise)}</td>
                    <td>
                      <span className={`state ${quote.status === "accepted" ? "good" : "quiet"}`}>
                        {quote.status === "accepted" ? "Won" : "Quoted"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
