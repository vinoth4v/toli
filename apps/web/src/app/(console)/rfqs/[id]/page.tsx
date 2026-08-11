import Link from "next/link"
import { notFound } from "next/navigation"
import { Amount, Badge, Card, Chip, Empty, Facts, PageHead, StatusBadge } from "@/components/ui"
import { getRequest, termsOf } from "@/data/demand"
import { listActiveOperators } from "@/data/supply"
import { verdict } from "@/domain/fairprice"
import { formatIst, maskPhone } from "@/domain/format"
import { mapLink } from "@/domain/geo"
import { GST_TREATMENTS } from "@/domain/gst"
import { formatPaise } from "@/domain/money"
import { quoteChips } from "@/domain/quote"
import { extraLabel, pricingBasis, tripTypeLabel } from "@/domain/trip"
import { featureLabel, vehicleClassLabel } from "@/domain/vehicle"
import { isConfigured } from "@/integrations/config"
import { resolveItineraryAction } from "../../integrations/actions"
import { acceptQuoteAction, inviteOperatorsAction, submitQuoteAction } from "../actions"

/**
 * Quote comparison — the product's core UX claim.
 *
 * Five quotes, the same six chips in the same order on each, one estimated
 * total and one honest worst case. §4.1: the reason group booking is miserable
 * today is that quotes are not comparable, and forcing every quote into the
 * same schema is most of the win.
 */

export const dynamic = "force-dynamic"

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const detail = await getRequest(id)
  if (!detail) notFound()

  const { request, customer, stops, quotes, band, shape } = detail
  const operators = await listActiveOperators()
  const invited = new Set(quotes.map((quote) => quote.operatorId))
  const uninvited = operators.filter((operator) => !invited.has(operator.id))
  const answered = quotes.filter((quote) => quote.status !== "requested")
  const outstanding = quotes.filter((quote) => quote.status === "requested")
  const basis = pricingBasis(request.tripType)
  const mapsLive = isConfigured("maps") && isConfigured("routing")

  return (
    <>
      <PageHead
        title={request.reference}
        intro={
          <>
            {tripTypeLabel(request.tripType)} from {request.city} · {request.passengerCount}{" "}
            passengers · {request.vehicleCount} × {vehicleClassLabel(request.vehicleClass)}
          </>
        }
        actions={<StatusBadge status={request.status} />}
      />

      {error ? <p role="alert">{error}</p> : null}

      <div className="split">
        <div>
          {band ? (
            <p className="band">
              <strong>Toli Fair Price</strong>
              <span>
                Comparable trips quote between <Amount paise={band.p25Paise} /> and{" "}
                <Amount paise={band.p75Paise} />
              </span>
              <span className="muted small">{band.sampleSize} past quotes</span>
            </p>
          ) : null}

          <Card title={`Quotes (${answered.length})`}>
            {answered.length === 0 ? (
              <Empty>
                No operator has answered yet. Invite operators on the right, then record what each
                one quotes.
              </Empty>
            ) : (
              answered.map((quote) => {
                const priced = quote.priced
                const chips = quoteChips(termsOf(quote), shape)
                const placing = band ? verdict(quote.estimatedTotalPaise, band) : null

                return (
                  <article
                    key={quote.id}
                    className={quote.status === "accepted" ? "quote-card accepted" : "quote-card"}
                  >
                    <header className="quote-head">
                      <div>
                        <h3>{quote.operatorName}</h3>
                        <span className="muted small">
                          {quote.operatorTier} tier · quoted {formatIst(quote.submittedAt)}
                          {quote.validUntil ? ` · valid to ${formatIst(quote.validUntil)}` : ""}
                        </span>
                      </div>
                      <div className="price">
                        <Amount paise={quote.estimatedTotalPaise} />
                        <span className="worst">
                          worst case <Amount paise={quote.worstCaseTotalPaise} />
                        </span>
                      </div>
                    </header>

                    <div className="chips">
                      {chips.map((chip) => (
                        <Chip key={chip.label} tone={chip.tone}>
                          {chip.label}
                        </Chip>
                      ))}
                      {placing ? (
                        <Badge
                          tone={placing === "above" ? "stop" : placing === "below" ? "warn" : "ok"}
                        >
                          {placing === "within"
                            ? "within the fair price band"
                            : placing === "above"
                              ? "above the band"
                              : "below the band — check what is excluded"}
                        </Badge>
                      ) : null}
                    </div>

                    {priced ? (
                      <>
                        <div className="table-wrap">
                          <table className="ledger">
                            <tbody>
                              {priced.lines.map((line) => (
                                <tr key={line.label}>
                                  <td>
                                    {line.label}
                                    {line.detail ? (
                                      <div className="muted small">{line.detail}</div>
                                    ) : null}
                                  </td>
                                  <td className="right">{formatPaise(line.amountPaise)}</td>
                                </tr>
                              ))}
                              <tr>
                                <td>
                                  GST
                                  <div className="muted small">
                                    {GST_TREATMENTS[quote.gstTreatment].label}
                                  </div>
                                </td>
                                <td className="right">{formatPaise(priced.taxPaise)}</td>
                              </tr>
                              <tr className="total">
                                <td>Estimated total</td>
                                <td className="right">{formatPaise(priced.estimatedTotalPaise)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {priced.minimumKmShortfall > 0 ? (
                          <p className="notice">
                            {priced.minimumKmShortfall} km of the {priced.chargeableKm} km charged
                            will not be travelled — the {quote.minKmPerDay} km/day minimum. This is
                            the charge customers are most often surprised by.
                          </p>
                        ) : null}

                        {priced.worstCaseItems.length > 0 ? (
                          <details>
                            <summary className="small muted">
                              What could push this to {formatPaise(priced.worstCaseTotalPaise)}
                            </summary>
                            <div className="table-wrap">
                              <table>
                                <tbody>
                                  {priced.worstCaseItems.map((item) => (
                                    <tr key={item.label}>
                                      <td>
                                        {item.label}
                                        <div className="muted small">{item.reason}</div>
                                      </td>
                                      <td className="right">{formatPaise(item.amountPaise)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        ) : null}
                      </>
                    ) : null}

                    {quote.notes ? <p className="small">{quote.notes}</p> : null}

                    {quote.status === "submitted" && request.status !== "booked" ? (
                      <form action={acceptQuoteAction}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <button type="submit">Accept and book</button>
                      </form>
                    ) : (
                      <StatusBadge status={quote.status} />
                    )}
                  </article>
                )
              })
            )}
          </Card>

          {outstanding.length > 0 ? (
            <Card title={`Awaiting a reply (${outstanding.length})`}>
              <p className="muted small">
                These operators have been asked. Record what each one says — by phone, WhatsApp or
                the partner app — in the same schema, so the comparison above stays like-for-like.
              </p>
              {outstanding.map((quote) => (
                <details key={quote.id} className="quote-card">
                  <summary>
                    <strong>{quote.operatorName}</strong>{" "}
                    <span className="muted small">
                      asked {formatIst(quote.requestedAt)} — record their quote
                    </span>
                  </summary>

                  <form action={submitQuoteAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />

                    {basis === "distance" ? (
                      <div className="row">
                        <div>
                          <label htmlFor={`perKmRate-${quote.id}`}>Per-km rate ₹</label>
                          <input id={`perKmRate-${quote.id}`} name="perKmRate" required />
                        </div>
                        <div>
                          <label htmlFor={`minKmPerDay-${quote.id}`}>
                            Minimum km/day
                            <span className="hint">Mandatory — usually 250–300</span>
                          </label>
                          <input
                            id={`minKmPerDay-${quote.id}`}
                            name="minKmPerDay"
                            type="number"
                            min="0"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor={`baseFare-${quote.id}`}>Base fare ₹</label>
                          <input id={`baseFare-${quote.id}`} name="baseFare" defaultValue="0" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row">
                          <div>
                            <label htmlFor={`baseFare-${quote.id}`}>Base fare ₹</label>
                            <input id={`baseFare-${quote.id}`} name="baseFare" required />
                          </div>
                          <div>
                            <label htmlFor={`includedKm-${quote.id}`}>Included km</label>
                            <input
                              id={`includedKm-${quote.id}`}
                              name="includedKm"
                              type="number"
                              min="0"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor={`includedHours-${quote.id}`}>Included hours</label>
                            <input
                              id={`includedHours-${quote.id}`}
                              name="includedHours"
                              type="number"
                              min="0"
                              required
                            />
                          </div>
                        </div>
                        <div className="row">
                          <div>
                            <label htmlFor={`extraKmRate-${quote.id}`}>Extra km rate ₹</label>
                            <input id={`extraKmRate-${quote.id}`} name="extraKmRate" required />
                          </div>
                          <div>
                            <label htmlFor={`extraHourRate-${quote.id}`}>Extra hour rate ₹</label>
                            <input id={`extraHourRate-${quote.id}`} name="extraHourRate" required />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="row">
                      <div>
                        <label htmlFor={`driverBata-${quote.id}`}>Driver bata ₹/day</label>
                        <input id={`driverBata-${quote.id}`} name="driverBata" defaultValue="0" />
                      </div>
                      <div>
                        <label htmlFor={`nightHalt-${quote.id}`}>Night halt ₹</label>
                        <input id={`nightHalt-${quote.id}`} name="nightHalt" defaultValue="0" />
                      </div>
                    </div>

                    <div className="checks">
                      <label htmlFor={`toll-${quote.id}`}>
                        <input id={`toll-${quote.id}`} name="tollIncluded" type="checkbox" />
                        Toll included
                      </label>
                      <label htmlFor={`parking-${quote.id}`}>
                        <input id={`parking-${quote.id}`} name="parkingIncluded" type="checkbox" />
                        Parking included
                      </label>
                      <label htmlFor={`permit-${quote.id}`}>
                        <input
                          id={`permit-${quote.id}`}
                          name="statePermitIncluded"
                          type="checkbox"
                        />
                        Interstate permit tax included
                      </label>
                      <label htmlFor={`fuel-${quote.id}`}>
                        <input
                          id={`fuel-${quote.id}`}
                          name="fuelIncluded"
                          type="checkbox"
                          defaultChecked
                        />
                        Fuel included
                      </label>
                    </div>

                    <div>
                      <label htmlFor={`notes-${quote.id}`}>Notes</label>
                      <input id={`notes-${quote.id}`} name="notes" />
                    </div>

                    <div className="button-row">
                      <button type="submit">Record quote</button>
                    </div>
                  </form>
                </details>
              ))}
            </Card>
          ) : null}
        </div>

        <div>
          <Card title="Requirement">
            <Facts
              items={[
                ["Customer", `${customer.name} · ${maskPhone(customer.phone)}`],
                ["GSTIN", customer.gstin ?? "not registered"],
                ["Departs", formatIst(request.startAt)],
                ["Returns", request.endAt ? formatIst(request.endAt) : "one way"],
                ["Duration", `${shape.days} day(s), ${shape.nights} night(s)`],
                ["Estimated running", request.estimatedKm ? `${request.estimatedKm} km` : "—"],
                ["AC", request.acRequired ? "required" : "not required"],
                [
                  "Interstate",
                  request.interstate ? request.statesCrossed.join(", ") : "stays in state",
                ],
              ]}
            />

            {stops.length > 0 ? (
              <>
                <h3>Route</h3>
                <ul className="timeline">
                  {stops.map((stop) => (
                    <li key={stop.id}>
                      {stop.label}
                      {stop.lat && stop.lng ? (
                        <time>
                          <a
                            href={mapLink({ lat: Number(stop.lat), lng: Number(stop.lng) })}
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            {Number(stop.lat).toFixed(4)}, {Number(stop.lng).toFixed(4)}
                          </a>
                        </time>
                      ) : (
                        <time className="muted">not placed on the map yet</time>
                      )}
                    </li>
                  ))}
                </ul>

                <form action={resolveItineraryAction}>
                  <input type="hidden" name="tripRequestId" value={request.id} />
                  <button type="submit" className="quiet">
                    Place stops and measure the road
                  </button>
                </form>
                <p className="muted small">
                  {mapsLive
                    ? "Geocodes each stop and measures the road distance, which fills in the estimated km every quote is priced against — and gives live tracking a route to detect deviation from."
                    : "Geocoding is not configured, so this will name the missing variable rather than guess. Estimated km stays whatever was typed on the call."}
                </p>
              </>
            ) : null}

            {request.features.length > 0 || request.extras.length > 0 ? (
              <>
                <h3>Asked for</h3>
                <div className="chips">
                  {request.features.map((feature) => (
                    <Chip key={feature}>{featureLabel(feature)}</Chip>
                  ))}
                  {request.extras.map((extra) => (
                    <Chip key={extra}>{extraLabel(extra)}</Chip>
                  ))}
                </div>
              </>
            ) : null}

            {request.notes ? (
              <>
                <h3>In their words</h3>
                <p className="small">{request.notes}</p>
              </>
            ) : null}
          </Card>

          <Card title="Fan out">
            {uninvited.length === 0 ? (
              <Empty>
                Every operator on the platform has been asked.{" "}
                <Link href="/operators/new">Sign another one</Link>.
              </Empty>
            ) : (
              <form action={inviteOperatorsAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <p className="muted small">
                  Inviting an operator records the moment they were asked. That timestamp is the
                  denominator of the response rate — an RFQ nobody was asked about must not count as
                  one nobody answered.
                </p>
                <div className="checks">
                  {uninvited.map((operator) => (
                    <label key={operator.id} htmlFor={`op-${operator.id}`}>
                      <input
                        id={`op-${operator.id}`}
                        name="operatorIds"
                        type="checkbox"
                        value={operator.id}
                      />
                      {operator.name}
                      <span className="muted small"> · {operator.city}</span>
                    </label>
                  ))}
                </div>
                <button type="submit">Ask these operators</button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
