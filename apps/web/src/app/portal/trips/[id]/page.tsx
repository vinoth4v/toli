import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { MapEmbed } from "@/components/map"
import { shapeOf, termsOf } from "@/data/demand"
import { customerTrip, tripExpensesFor } from "@/data/scoped"
import { buildBill, tollNotice } from "@/domain/bill"
import { formatIst } from "@/domain/format"
import { checkPing } from "@/domain/geo"
import { formatPaise } from "@/domain/money"
import { priceQuote, quoteChips } from "@/domain/quote"
import { tripTypeLabel } from "@/domain/trip"
import { vehicleClassLabel } from "@/domain/vehicle"
import { acceptOwnQuoteAction } from "../../actions"

/**
 * One trip, as the person paying for it sees it.
 *
 * The quotes are the same rows the ops console shows, priced by the same
 * function — but the framing is different, because this reader has never heard
 * the word "bata" and is deciding whether to hand over ₹16,000. So the
 * cheapest is marked, the worst case is spelled out in a sentence rather than
 * a column header, and the minimum-km trap gets named in full when it applies.
 */

export const dynamic = "force-dynamic"

export default async function PortalTripPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()])
  const customerId = session?.user.customerId
  if (!customerId) redirect("/login")

  const trip = await customerTrip(customerId, id)
  if (!trip) notFound()

  const { request, stops, quotes, booking, operatorName, invoice, assignment } = trip

  // The bill exists only once there is a booking: before that, a quote is a
  // promise and there is nothing to reconcile it against.
  const billing = booking ? await tripExpensesFor(customerId, booking.id) : null
  const livePosition =
    booking && trip.latestPing ? checkPing(trip.latestPing.lat, trip.latestPing.lng) : null
  const bill =
    booking && billing
      ? buildBill({
          quotedTotalPaise: booking.agreedTotalPaise,
          gstTreatment: booking.gstTreatment,
          intraState: booking.intraState,
          tollIncluded: billing.tollIncluded,
          parkingIncluded: billing.parkingIncluded,
          statePermitIncluded: billing.statePermitIncluded,
          expenses: billing.expenses,
          paymentsPaise: billing.paidPaise,
        })
      : null
  const shape = shapeOf(request)
  const cheapest = quotes.reduce<number | null>(
    (best, row) =>
      best === null || row.quote.estimatedTotalPaise < best ? row.quote.estimatedTotalPaise : best,
    null,
  )

  return (
    <>
      <p className="crumb">
        <Link href="/portal">← Your trips</Link>
      </p>

      <header className="portal-head">
        <div>
          <h1>
            {request.city} · {tripTypeLabel(request.tripType)}
          </h1>
          <p className="muted">
            {formatIst(request.startAt)} · {request.passengerCount} people ·{" "}
            {vehicleClassLabel(request.vehicleClass)}
          </p>
        </div>
      </header>

      {stops.length > 0 ? (
        <section className="route-strip">
          {stops.map((stop, index) => (
            <span key={stop.id}>
              {stop.label}
              {index < stops.length - 1 ? <em>→</em> : null}
            </span>
          ))}
        </section>
      ) : null}

      {booking ? (
        <section className="booked-panel">
          <div>
            <p className="eyebrow">Booked with</p>
            <h2>{operatorName}</h2>
            <p className="price-large">{formatPaise(booking.agreedTotalPaise)}</p>
            <p className="muted small">
              Advance {formatPaise(booking.advanceDuePaise)} · reference {booking.reference}
            </p>
          </div>
          <div className="booked-side">
            {assignment ? (
              <>
                <p className="eyebrow">Your vehicle</p>
                <p className="numeric big">{assignment.vehicle.registrationNumber}</p>
                <p className="muted small">
                  {assignment.vehicle.seats} seats · driver {assignment.driverName}
                </p>
              </>
            ) : (
              <p className="muted small">
                Vehicle and driver details are shared 12 hours before departure.
              </p>
            )}

            <p className="track-link">
              <Link href={`/track/${booking.trackingToken}`}>Live tracking link →</Link>
              <span className="muted small">
                Share it with anyone. No app, no sign-in, and it shows no prices.
              </span>
            </p>

            {invoice ? (
              <p className="muted small">
                Invoice {invoice.number} · {formatPaise(invoice.totalPaise)} including GST
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {livePosition?.ok ? (
        <MapEmbed point={livePosition.point} label="Where your vehicle is now" height={300} />
      ) : null}

      {bill ? (
        <section className="bill">
          <h2>Your bill</h2>
          <table className="bill-table">
            <tbody>
              {bill.lines.map((line) => (
                <tr key={line.label} className={line.addedAfterQuote ? "added" : undefined}>
                  <td>
                    {line.label}
                    {line.detail ? <div className="muted small">{line.detail}</div> : null}
                  </td>
                  <td>{formatPaise(line.amountPaise)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td>{formatPaise(bill.totalPaise)}</td>
              </tr>
              {bill.paidPaise > 0 ? (
                <>
                  <tr>
                    <td>Paid so far</td>
                    <td>−{formatPaise(bill.paidPaise)}</td>
                  </tr>
                  <tr className="total">
                    <td>Still to pay</td>
                    <td>{formatPaise(bill.duePaise)}</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>

          <p className="bill-note">{tollNotice(billing?.tollIncluded ?? false)}</p>

          {bill.asQuoted ? (
            <p className="muted small">Nothing was added after the quote you accepted.</p>
          ) : null}
        </section>
      ) : null}

      <h2 className="portal-section">
        {quotes.length === 0
          ? "No quotes yet"
          : booking
            ? `What the ${quotes.length} operators quoted`
            : `${quotes.length} quotes`}
      </h2>

      {quotes.length === 0 ? (
        <p className="muted">
          Operators usually reply within thirty minutes. We will message you as they come in.
        </p>
      ) : (
        <div className="quote-grid">
          {quotes.map(({ quote, operatorName: name, tier }) => {
            const priced = priceQuote(termsOf(quote), shape)
            const chips = quoteChips(termsOf(quote), shape)
            const isCheapest = quote.estimatedTotalPaise === cheapest
            const isBooked = quote.status === "accepted"

            return (
              <article
                key={quote.id}
                className={`offer${isBooked ? " chosen" : ""}${isCheapest && !booking ? " cheapest" : ""}`}
              >
                {isBooked ? <p className="ribbon">Your booking</p> : null}
                {isCheapest && !booking ? <p className="ribbon">Lowest quote</p> : null}

                <h3>{name}</h3>
                <p className="muted small">{tier} tier operator</p>

                <p className="price-large">{formatPaise(quote.estimatedTotalPaise)}</p>
                <p className="worst-line">
                  Could reach <strong>{formatPaise(quote.worstCaseTotalPaise)}</strong> if the
                  excluded charges apply.
                </p>

                <ul className="chip-list">
                  {chips.map((chip) => (
                    <li key={chip.label} className={`chip ${chip.tone}`}>
                      {chip.label}
                    </li>
                  ))}
                </ul>

                {priced.minimumKmShortfall > 0 ? (
                  <p className="trap">
                    You will be charged for {priced.chargeableKm} km but travel about{" "}
                    {shape.estimatedKm} km — this operator bills a minimum of {quote.minKmPerDay} km
                    a day.
                  </p>
                ) : null}

                <details>
                  <summary>Where the money goes</summary>
                  <table className="offer-lines">
                    <tbody>
                      {priced.lines.map((line) => (
                        <tr key={line.label}>
                          <td>
                            {line.label}
                            {line.detail ? <div className="muted small">{line.detail}</div> : null}
                          </td>
                          <td>{formatPaise(line.amountPaise)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td>GST</td>
                        <td>{formatPaise(priced.taxPaise)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {priced.worstCaseItems.length > 0 ? (
                    <>
                      <p className="muted small">What could be added on top:</p>
                      <table className="offer-lines">
                        <tbody>
                          {priced.worstCaseItems.map((item) => (
                            <tr key={item.label}>
                              <td>
                                {item.label}
                                <div className="muted small">{item.reason}</div>
                              </td>
                              <td>{formatPaise(item.amountPaise)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}
                </details>

                {!booking && quote.status === "submitted" ? (
                  <form action={acceptOwnQuoteAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="requestId" value={request.id} />
                    <button type="submit">Book this one</button>
                  </form>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
