import Link from "next/link"
import { notFound } from "next/navigation"
import { Empty, EnquiryBadge, ErrorBanner, Line, Money, PageHead, QuoteBadge } from "@/components/ui"
import { getEnquiry } from "@/db/enquiries"
import { listQuotableVehicles } from "@/db/operators"
import { listQuotesForEnquiry } from "@/db/quotes"
import { formatIst, relativeDays } from "@/domain/datetime"
import { formatBps, formatInr } from "@/domain/money"
import { computeQuote, GST_LABELS, GST_RATES, TRIP_TYPE_LABELS } from "@/domain/pricing"
import { vehicleClassLabel } from "@/domain/vehicles"
import {
  acceptQuoteAction,
  createQuoteAction,
  declineQuoteAction,
  markEnquiryLostAction,
  sendQuoteAction,
} from "../actions.ts"

export const dynamic = "force-dynamic"

export default async function EnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const enquiry = await getEnquiry(id)
  if (!enquiry) notFound()

  const [quotes, quotable] = await Promise.all([listQuotesForEnquiry(id), listQuotableVehicles()])

  /**
   * What each available vehicle would cost on this trip, priced before anyone
   * picks one. Same engine that will store the quote, so the number in the
   * dropdown is the number that gets quoted — not an estimate that drifts.
   */
  const priced = quotable.map((row) => ({
    ...row,
    fare: computeQuote({
      vehicleClass: row.vehicle.class,
      tripType: enquiry.tripType,
      estimatedKm: enquiry.estimatedKm,
      days: enquiry.days,
      perKmPaiseOverride: row.vehicle.perKmPaise,
      commissionBps: row.operator.commissionBps,
    }),
  }))

  const settled = enquiry.status === "won" || enquiry.status === "lost"

  return (
    <main>
      <PageHead
        title={`${enquiry.origin} → ${enquiry.destination}`}
        subtitle={`${enquiry.ref} · taken ${relativeDays(enquiry.createdAt)}`}
      >
        <EnquiryBadge status={enquiry.status} />
        {settled ? null : (
          <form action={markEnquiryLostAction}>
            <input type="hidden" name="enquiryId" value={enquiry.id} />
            <button className="secondary" type="submit">
              Mark lost
            </button>
          </form>
        )}
      </PageHead>

      <ErrorBanner message={error} />

      <div className="columns">
        <section className="card">
          <h2>The trip</h2>
          <dl className="lines">
            <Line label="Customer" value={enquiry.customerName} />
            <Line label="Phone" value={enquiry.customerPhone} />
            {enquiry.customerEmail ? <Line label="Email" value={enquiry.customerEmail} /> : null}
            <Line label="Leaves" value={`${formatIst(enquiry.startAt)} IST`} />
            <Line label="Trip type" value={TRIP_TYPE_LABELS[enquiry.tripType]} />
            <Line label="Days" value={String(enquiry.days)} />
            <Line label="Distance" value={`${enquiry.estimatedKm} km`} />
            <Line label="Passengers" value={String(enquiry.passengers)} />
            <Line label="Class wanted" value={vehicleClassLabel(enquiry.vehicleClass)} />
          </dl>
          {enquiry.notes ? <p className="small muted">{enquiry.notes}</p> : null}
        </section>

        <section className="card">
          <h2>Price it</h2>
          {priced.length === 0 ? (
            <Empty>
              No vehicle can be quoted yet. A vehicle has to belong to a{" "}
              <Link href="/operators">verified operator</Link> and be listed as active.
            </Empty>
          ) : (
            <form action={createQuoteAction}>
              <input type="hidden" name="enquiryId" value={enquiry.id} />
              <div className="form-grid">
                <div className="field-wide">
                  <label htmlFor="vehicleId">Operator and vehicle</label>
                  <select id="vehicleId" name="vehicleId" required>
                    {priced.map((row) => (
                      <option key={row.vehicle.id} value={row.vehicle.id}>
                        {row.operator.name} · {row.vehicle.registration} ·{" "}
                        {vehicleClassLabel(row.vehicle.class)} · {formatInr(row.fare.totalPaise)}
                      </option>
                    ))}
                  </select>
                  <span className="hint">
                    Priced for this trip at each operator&rsquo;s own rate, tax included.
                  </span>
                </div>
                <div>
                  <label htmlFor="tollsParkingRupees">Tolls, permits, parking (₹)</label>
                  <input
                    id="tollsParkingRupees"
                    name="tollsParkingRupees"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                  />
                  <span className="hint">Passed through at cost.</span>
                </div>
                <div>
                  <label htmlFor="gstRateBps">GST treatment</label>
                  <select id="gstRateBps" name="gstRateBps" defaultValue="500">
                    {GST_RATES.map((rate) => (
                      <option key={rate} value={String(rate)}>
                        {GST_LABELS[rate]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="validDays">Valid for (days)</label>
                  <input
                    id="validDays"
                    name="validDays"
                    type="number"
                    min="1"
                    max="30"
                    defaultValue="7"
                  />
                </div>
              </div>
              <button type="submit">Add quote</button>
            </form>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Quotes</h2>
        {quotes.length === 0 ? (
          <Empty>No quote yet. Price one above and send it to the customer.</Empty>
        ) : (
          <div className="stack">
            {quotes.map(({ quote, operator, vehicle }) => (
              <article key={quote.id} className="card">
                <div className="page-head">
                  <div>
                    <h3>{operator.name}</h3>
                    <p className="subtitle small">
                      {vehicle
                        ? `${vehicle.registration} · ${vehicleClassLabel(vehicle.class)}`
                        : "vehicle no longer listed"}{" "}
                      · valid to {formatIst(quote.validUntil)}
                    </p>
                  </div>
                  <div className="actions">
                    <QuoteBadge status={quote.status} />
                  </div>
                </div>

                <dl className="lines">
                  <Line
                    label={`${quote.chargeableKm} km × ₹${(quote.perKmPaise / 100).toFixed(2)}/km`}
                    value={formatInr(quote.baseFarePaise)}
                  />
                  <Line
                    label="Driver allowance"
                    value={formatInr(quote.driverAllowancePaise)}
                  />
                  {quote.nightHaltPaise > 0 ? (
                    <Line label="Night halt" value={formatInr(quote.nightHaltPaise)} />
                  ) : null}
                  {quote.tollsParkingPaise > 0 ? (
                    <Line
                      label="Tolls, permits and parking"
                      value={formatInr(quote.tollsParkingPaise)}
                    />
                  ) : null}
                  <Line label="Fare before tax" value={formatInr(quote.subtotalPaise)} />
                  <Line
                    label={`GST at ${formatBps(quote.gstRateBps)}`}
                    value={formatInr(quote.gstPaise)}
                  />
                  <Line label="Customer pays" value={formatInr(quote.totalPaise)} total />
                  <Line
                    label={`Our commission (${formatBps(quote.commissionBps)})`}
                    value={formatInr(quote.commissionPaise)}
                  />
                  <Line label="Operator receives" value={formatInr(quote.operatorPayoutPaise)} />
                </dl>

                {quote.status === "draft" || quote.status === "sent" ? (
                  <div className="actions">
                    {quote.status === "draft" ? (
                      <form action={sendQuoteAction}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="enquiryId" value={enquiry.id} />
                        <button type="submit">Mark sent</button>
                      </form>
                    ) : null}
                    <form action={acceptQuoteAction}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <input type="hidden" name="enquiryId" value={enquiry.id} />
                      <button type="submit">Customer accepted</button>
                    </form>
                    <form action={declineQuoteAction}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <input type="hidden" name="enquiryId" value={enquiry.id} />
                      <button className="secondary" type="submit">
                        Declined
                      </button>
                    </form>
                  </div>
                ) : null}

                {quote.status === "accepted" ? (
                  <p className="small">
                    Booked · <Money paise={quote.totalPaise} /> ·{" "}
                    <Link href="/bookings">see bookings</Link>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
