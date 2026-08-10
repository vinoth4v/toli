import Link from "next/link"
import { notFound } from "next/navigation"
import {
  awardQuoteAction,
  cancelRequestAction,
  recordQuoteAction,
} from "@/app/requests/actions"
import { auth } from "@/auth"
import { Badge, Card, Empty, Stat, statusTone } from "@/components/bits"
import { Shell } from "@/components/shell"
import {
  getBookingForRequest,
  getRequest,
  listOperatorsWithVehicles,
  listQuotes,
} from "@/db/queries"
import { segmentLabel, VEHICLE_KINDS, vehicleKindLabel } from "@/lib/catalog"
import { formatRange } from "@/lib/dates"
import { formatInr } from "@/lib/money"
import { matchOperators } from "@/lib/matching"
import { rankQuotes, settlement, splitAdvance, tripDuration } from "@/lib/pricing"

export const dynamic = "force-dynamic"

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, { error }, session] = await Promise.all([params, searchParams, auth()])

  const request = await getRequest(id)
  if (!request) notFound()

  const [quotes, operators, booked] = await Promise.all([
    listQuotes(id),
    listOperatorsWithVehicles(),
    getBookingForRequest(id),
  ])

  const { days, nights } = tripDuration(request.startDate, request.endDate)
  const trip = {
    days,
    nights,
    estimatedKm: request.estimatedKm,
    passengers: request.passengers,
  }

  const ranked = rankQuotes(trip, quotes)
  const matches = matchOperators(request, operators)
  const matchedIds = new Set(matches.map((match) => match.operator.id))
  const alreadyQuoted = new Set(quotes.map((quote) => quote.operatorId))
  const isOpen = request.status === "open"

  return (
    <Shell email={session?.user?.email}>
      <div className="page-head">
        <div>
          <h1>
            #{request.reference} · {request.customerName}{" "}
            <Badge tone={statusTone(request.status)}>{request.status}</Badge>
          </h1>
          <p className="lede">
            {segmentLabel(request.segment)} · {request.passengers} people ·{" "}
            {request.vehiclesNeeded}× {vehicleKindLabel(request.vehicleKind)}
          </p>
        </div>
        {isOpen ? (
          <form action={cancelRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <button type="submit" className="ghost">
              Cancel requirement
            </button>
          </form>
        ) : null}
      </div>

      {error === "quote" ? (
        <p role="alert">That quote was not usable — every amount must be a number in rupees.</p>
      ) : null}
      {error === "award" ? (
        <p role="alert">That quote could not be awarded. Reload and try again.</p>
      ) : null}

      <div className="stats">
        <Stat label="Dates" value={formatRange(request.startDate, request.endDate)} note={`${days} day${days === 1 ? "" : "s"}, ${nights} night${nights === 1 ? "" : "s"}`} />
        <Stat label="From" value={request.fromCity} />
        <Stat label="Running estimate" value={`${request.estimatedKm.toLocaleString("en-IN")} km`} />
        <Stat label="Contact" value={request.customerPhone} note={request.customerEmail ?? undefined} />
      </div>

      <Card title="Itinerary">
        <p className="wrap">{request.itinerary}</p>
        {request.notes ? <p className="muted wrap">{request.notes}</p> : null}
      </Card>

      {booked ? (
        <Card title="Awarded">
          <p>
            <strong>{booked.operatorName}</strong> · {booked.operatorPhone} ·{" "}
            <Badge tone={statusTone(booked.booking.status)}>{booked.booking.status}</Badge>
          </p>
          <div className="stats">
            <Stat label="All-in" value={formatInr(booked.booking.allInPaise)} />
            <Stat
              label="Advance"
              value={formatInr(booked.booking.advancePaise)}
              note={`balance ${formatInr(booked.booking.allInPaise - booked.booking.advancePaise)}`}
            />
            <Stat
              label="Toli commission"
              value={formatInr(booked.booking.commissionPaise)}
              note="settled to the operator at T+2"
            />
          </div>
        </Card>
      ) : null}

      <Card title="Toli Fair Price">
        {ranked.length === 0 ? (
          <Empty>
            No quotes yet. Call the matched operators below and record what they say.
          </Empty>
        ) : (
          <>
            <p className="muted">
              Landed cost for this trip — {trip.estimatedKm.toLocaleString("en-IN")} km over{" "}
              {days} day{days === 1 ? "" : "s"} — not the headline fare. A quote with a small base
              and a short kilometre allowance is not the cheap one.
            </p>
            <table className="grid">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Vehicle</th>
                  <th className="num">All-in</th>
                  <th className="num">vs best</th>
                  <th className="num">Per head</th>
                  <th>{isOpen ? "Award" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((entry) => {
                  const { commissionPaise, operatorPayoutPaise, agentWouldHaveTakenPaise } =
                    settlement(entry.priced.allInPaise, entry.quote.operatorCommissionBps)
                  const { advancePaise } = splitAdvance(entry.priced.allInPaise)

                  return (
                    <tr key={entry.quote.id} className={entry.rank === 1 ? "best" : undefined}>
                      <td>
                        {entry.quote.operatorName}
                        <span className="sub">
                          {entry.quote.operatorVerified ? "verified" : "unverified"} ·{" "}
                          {entry.quote.operatorPhone}
                        </span>
                      </td>
                      <td>
                        {vehicleKindLabel(entry.quote.vehicleKind)}
                        <span className="sub">{entry.quote.seats} seats</span>
                      </td>
                      <td className="num">
                        <strong>{formatInr(entry.priced.allInPaise)}</strong>
                        <span className="sub">advance {formatInr(advancePaise)}</span>
                      </td>
                      <td className="num">
                        {entry.rank === 1 ? (
                          <Badge tone="success">best</Badge>
                        ) : (
                          `+${formatInr(entry.deltaPaise)}`
                        )}
                      </td>
                      <td className="num">{formatInr(entry.priced.perPassengerPaise)}</td>
                      <td>
                        {isOpen ? (
                          <form action={awardQuoteAction}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <input type="hidden" name="quoteId" value={entry.quote.id} />
                            <button type="submit">Award</button>
                          </form>
                        ) : (
                          <Badge tone={statusTone(entry.quote.status)}>{entry.quote.status}</Badge>
                        )}
                        <details className="breakdown">
                          <summary>Breakdown</summary>
                          <table className="lines">
                            <tbody>
                              {entry.priced.lines.map((line) => (
                                <tr key={line.label}>
                                  <th scope="row">
                                    {line.label}
                                    <span className="sub">{line.note}</span>
                                  </th>
                                  <td className="num">{formatInr(line.amountPaise)}</td>
                                </tr>
                              ))}
                              <tr>
                                <th scope="row">Operator payout</th>
                                <td className="num">{formatInr(operatorPayoutPaise)}</td>
                              </tr>
                              <tr>
                                <th scope="row">
                                  Toli commission
                                  <span className="sub">
                                    an agent would have taken{" "}
                                    {formatInr(agentWouldHaveTakenPaise)}
                                  </span>
                                </th>
                                <td className="num">{formatInr(commissionPaise)}</td>
                              </tr>
                            </tbody>
                          </table>
                          {entry.quote.notes ? <p className="muted wrap">{entry.quote.notes}</p> : null}
                        </details>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <Card title="Matched operators">
        {matches.length === 0 ? (
          <Empty>
            No operator in {request.fromCity} has an active {vehicleKindLabel(request.vehicleKind)}{" "}
            or bigger. <Link href="/operators">Sign one</Link>.
          </Empty>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Would send</th>
                <th className="num">Seats</th>
                <th>Fit</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr key={match.operator.id}>
                  <td>
                    <Link href={`/operators/${match.operator.id}`}>{match.operator.name}</Link>
                    <span className="sub">
                      {match.operator.verified ? "verified" : "unverified"}
                    </span>
                  </td>
                  <td>
                    {match.vehiclesAvailable}× {vehicleKindLabel(match.bestVehicle.kind)}
                  </td>
                  <td className="num">{match.capacity}</td>
                  <td>
                    {match.partial ? (
                      <Badge tone="muted">part of the fleet</Badge>
                    ) : (
                      <Badge tone="success">full</Badge>
                    )}
                    {alreadyQuoted.has(match.operator.id) ? <Badge tone="accent">quoted</Badge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {isOpen ? (
        <Card title="Record a quote">
          <p className="muted">
            As it was given on the phone or on WhatsApp. Tick what the operator says is included —
            an excluded toll is not a discount.
          </p>
          <form action={recordQuoteAction} className="form-grid">
            <input type="hidden" name="requestId" value={request.id} />

            <fieldset>
              <legend>Who quoted</legend>
              <label htmlFor="operatorId">Operator</label>
              <select id="operatorId" name="operatorId" required defaultValue="">
                <option value="" disabled>
                  Choose an operator
                </option>
                <optgroup label="Matched">
                  {operators
                    .filter((operator) => matchedIds.has(operator.id))
                    .map((operator) => (
                      <option key={operator.id} value={operator.id}>
                        {operator.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Everyone else">
                  {operators
                    .filter((operator) => !matchedIds.has(operator.id))
                    .map((operator) => (
                      <option key={operator.id} value={operator.id}>
                        {operator.name} · {operator.city}
                      </option>
                    ))}
                </optgroup>
              </select>

              <label htmlFor="vehicleKind">Vehicle offered</label>
              <select
                id="vehicleKind"
                name="vehicleKind"
                defaultValue={request.vehicleKind}
                required
              >
                {VEHICLE_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>

              <label htmlFor="seats">Seats</label>
              <input id="seats" name="seats" inputMode="numeric" required />
            </fieldset>

            <fieldset>
              <legend>The fare</legend>
              <label htmlFor="baseFare">Base fare (₹)</label>
              <input id="baseFare" name="baseFare" inputMode="decimal" required />

              <label htmlFor="includedKm">Kilometres included</label>
              <input id="includedKm" name="includedKm" inputMode="numeric" required />

              <label htmlFor="perKm">Rate beyond that (₹ per km)</label>
              <input id="perKm" name="perKm" inputMode="decimal" required />

              <label htmlFor="driverBata">Driver bata (₹ per day)</label>
              <input id="driverBata" name="driverBata" inputMode="decimal" defaultValue="0" />

              <label htmlFor="nightHalt">Night halt (₹ per night)</label>
              <input id="nightHalt" name="nightHalt" inputMode="decimal" defaultValue="0" />
            </fieldset>

            <fieldset>
              <legend>The three that get left out</legend>

              <label htmlFor="tolls">Tolls (₹)</label>
              <input id="tolls" name="tolls" inputMode="decimal" defaultValue="0" />
              <label className="check">
                <input type="checkbox" name="tollsIncluded" /> Included in the fare
              </label>

              <label htmlFor="parking">Parking (₹)</label>
              <input id="parking" name="parking" inputMode="decimal" defaultValue="0" />
              <label className="check">
                <input type="checkbox" name="parkingIncluded" /> Included in the fare
              </label>

              <label htmlFor="permit">Interstate permit (₹)</label>
              <input id="permit" name="permit" inputMode="decimal" defaultValue="0" />
              <label className="check">
                <input type="checkbox" name="permitIncluded" /> Included in the fare
              </label>

              <label htmlFor="notes">Notes (optional)</label>
              <textarea id="notes" name="notes" rows={2} />
            </fieldset>

            <div className="form-actions">
              <button type="submit">Record the quote</button>
            </div>
          </form>
        </Card>
      ) : null}
    </Shell>
  )
}
