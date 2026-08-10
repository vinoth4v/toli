import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { Amount, Badge, Card, Empty, Facts, PageHead, StatusBadge } from "@/components/ui"
import { getBooking } from "@/data/fulfilment"
import { getSettings } from "@/data/settings"
import { getOperator } from "@/data/supply"
import { formatIst, maskPhone } from "@/domain/format"
import { GST_TREATMENTS } from "@/domain/gst"
import { formatBps, formatPaise } from "@/domain/money"
import { cancellationCharge, computeSettlement, releaseDueAt } from "@/domain/settlement"
import { tripTypeLabel } from "@/domain/trip"
import { vehicleClassLabel } from "@/domain/vehicle"
import {
  addExpenseAction,
  addPingAction,
  addReviewAction,
  addTripEventAction,
  assignVehicleAction,
  buildSettlementAction,
  cancelBookingAction,
  issueInvoiceAction,
  markSettlementPaidAction,
  openDisputeAction,
  recordPaymentAction,
  releaseSettlementAction,
} from "../actions"

export const dynamic = "force-dynamic"

function taxLines(invoice: {
  igstPaise: number
  cgstPaise: number
  sgstPaise: number
}): [string, ReactNode][] {
  return invoice.igstPaise > 0
    ? [["IGST", <Amount key="i" paise={invoice.igstPaise} />]]
    : [
        ["CGST", <Amount key="c" paise={invoice.cgstPaise} />],
        ["SGST", <Amount key="s" paise={invoice.sgstPaise} />],
      ]
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams])
  const detail = await getBooking(id)
  if (!detail) notFound()

  const {
    booking,
    request,
    customer,
    operator,
    quote,
    stops,
    payments,
    assignment,
    events,
    expenses,
    pings,
    invoice,
    settlement,
    review,
    disputes,
  } = detail

  const [settings, supply] = await Promise.all([getSettings(), getOperator(operator.id)])

  const captured = payments
    .filter((payment) => payment.status === "captured" && payment.kind !== "refund")
    .reduce((total, payment) => total + payment.amountPaise, 0)
  const outstanding = booking.agreedTotalPaise - captured

  const expensesPaise = expenses.reduce((total, expense) => total + expense.amountPaise, 0)
  const cashCollected = payments
    .filter((payment) => payment.mode === "cash_to_driver" && payment.status === "captured")
    .reduce((total, payment) => total + payment.amountPaise, 0)

  // Shown before it is built, so the ops desk and the operator see the same
  // arithmetic before anything is committed.
  const projected = computeSettlement({
    grossPaise: booking.agreedTotalPaise,
    commissionBps: booking.commissionBps,
    tcsBps: settings.tcsBps,
    tdsBps: settings.tdsBps,
    expensesReimbursedPaise: expensesPaise,
    cashCollectedPaise: cashCollected,
  })

  const cancellation = cancellationCharge({
    agreedTotalPaise: booking.agreedTotalPaise,
    departureAt: request.startAt,
    cancelledAt: new Date(),
  })

  const assignableVehicles = (supply?.vehicles ?? []).filter(
    (vehicle) => vehicle.status === "active",
  )

  return (
    <>
      <PageHead
        title={booking.reference}
        intro={
          <>
            {customer.name} · {tripTypeLabel(request.tripType)} from {request.city} ·{" "}
            {operator.name}
          </>
        }
        actions={<StatusBadge status={booking.status} />}
      />

      {error ? <p role="alert">{error}</p> : null}

      <div className="split">
        <div>
          <Card title="Money in">
            <Facts
              items={[
                ["Agreed total", <Amount key="t" paise={booking.agreedTotalPaise} />],
                [
                  "Advance due",
                  <>
                    <Amount paise={booking.advanceDuePaise} /> ({formatBps(settings.advanceBps)})
                  </>,
                ],
                ["Collected", <Amount key="c" paise={captured} />],
                ["Outstanding", <Amount key="o" paise={outstanding} />],
              ]}
            />

            {payments.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Mode</th>
                      <th className="right">Amount</th>
                      <th>Reference</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.kind}</td>
                        <td>{payment.mode.replace(/_/g, " ")}</td>
                        <td className="right">{formatPaise(payment.amountPaise)}</td>
                        <td className="numeric">{payment.gatewayRef ?? "—"}</td>
                        <td>{formatIst(payment.collectedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <form action={recordPaymentAction} className="inline-form">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div>
                <label htmlFor="kind">Kind</label>
                <select id="kind" name="kind" defaultValue="advance">
                  <option value="advance">Advance</option>
                  <option value="balance">Balance</option>
                  <option value="refund">Refund</option>
                </select>
              </div>
              <div>
                <label htmlFor="mode">Mode</label>
                <select id="mode" name="mode" defaultValue="upi">
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="netbanking">Netbanking</option>
                  <option value="neft">NEFT</option>
                  <option value="cash_to_driver">Cash to driver</option>
                </select>
              </div>
              <div>
                <label htmlFor="amount">Amount ₹</label>
                <input
                  id="amount"
                  name="amount"
                  defaultValue={String(Math.round(booking.advanceDuePaise / 100))}
                />
              </div>
              <div>
                <label htmlFor="gatewayRef">Reference</label>
                <input id="gatewayRef" name="gatewayRef" placeholder="pay_ / UTR" />
              </div>
              <button type="submit">Record</button>
            </form>
          </Card>

          <Card title="Assignment">
            {assignment ? (
              <Facts
                items={[
                  [
                    "Vehicle",
                    `${assignment.vehicle.registrationNumber} · ${assignment.vehicle.seats} seats`,
                  ],
                  ["Driver", `${assignment.driver.name} · ${maskPhone(assignment.driver.phone)}`],
                  ["Assigned", formatIst(assignment.assignedAt)],
                  [
                    "Sub-contracted",
                    assignment.subContractedToOperatorId ? "yes — liability trail recorded" : "no",
                  ],
                ]}
              />
            ) : assignableVehicles.length === 0 || (supply?.drivers.length ?? 0) === 0 ? (
              <Empty>
                {operator.name} has no active vehicle and driver to assign.{" "}
                <Link href={`/operators/${operator.id}`}>Add them</Link>.
              </Empty>
            ) : (
              <form action={assignVehicleAction} className="inline-form">
                <input type="hidden" name="bookingId" value={booking.id} />
                <div>
                  <label htmlFor="vehicleId">Vehicle</label>
                  <select id="vehicleId" name="vehicleId" required>
                    {assignableVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.registrationNumber} · {vehicle.seats} seats
                        {vehicle.compliance.fitForInterstate ? "" : " · in-state only"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="driverId">Driver</label>
                  <select id="driverId" name="driverId" required>
                    {(supply?.drivers ?? []).map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit">Assign</button>
              </form>
            )}
            {request.interstate ? (
              <p className="muted small">
                Interstate trip through {request.statesCrossed.join(", ")} — a vehicle without a
                valid All India Tourist Permit will be refused here.
              </p>
            ) : null}
          </Card>

          <Card title="Trip">
            {events.length === 0 ? (
              <Empty>Nothing has happened on this trip yet.</Empty>
            ) : (
              <ul className="timeline">
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{event.kind.replace(/_/g, " ")}</strong>
                    {event.detail ? ` — ${event.detail}` : ""}
                    {event.odometerKm ? ` · ${event.odometerKm} km` : ""}
                    <time>{formatIst(event.at)}</time>
                  </li>
                ))}
              </ul>
            )}

            <form action={addTripEventAction} className="inline-form">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div>
                <label htmlFor="eventKind">Event</label>
                <select id="eventKind" name="kind" defaultValue="dispatched">
                  <option value="dispatched">Dispatched</option>
                  <option value="started">Started</option>
                  <option value="stop_reached">Stop reached</option>
                  <option value="deviation">Deviation</option>
                  <option value="sos">SOS</option>
                  <option value="completed">Completed</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div>
                <label htmlFor="detail">Detail</label>
                <input id="detail" name="detail" />
              </div>
              <div>
                <label htmlFor="odometerKm">Odometer</label>
                <input id="odometerKm" name="odometerKm" type="number" min="0" />
              </div>
              <button type="submit">Record</button>
            </form>

            <details>
              <summary className="small muted">
                Record a position ({pings.length} on file — the tracking link reads the latest)
              </summary>
              <form action={addPingAction} className="inline-form">
                <input type="hidden" name="bookingId" value={booking.id} />
                <div>
                  <label htmlFor="lat">Latitude</label>
                  <input id="lat" name="lat" placeholder="26.9124" required />
                </div>
                <div>
                  <label htmlFor="lng">Longitude</label>
                  <input id="lng" name="lng" placeholder="75.7873" required />
                </div>
                <div>
                  <label htmlFor="speedKmph">Speed</label>
                  <input id="speedKmph" name="speedKmph" type="number" min="0" />
                </div>
                <button type="submit">Add</button>
              </form>
              <p className="muted small">
                The driver app and an AIS-140 VLTD feed will both write here. Until they exist, a
                position read out over the phone keeps the guest tracking link alive.
              </p>
            </details>
          </Card>

          <Card title="Expenses on the road">
            {expenses.length === 0 ? (
              <Empty>No expenses recorded.</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td>{expense.kind.replace(/_/g, " ")}</td>
                        <td className="right">{formatPaise(expense.amountPaise)}</td>
                        <td>{formatIst(expense.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form action={addExpenseAction} className="inline-form">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div>
                <label htmlFor="expenseKind">Kind</label>
                <select id="expenseKind" name="kind" defaultValue="toll">
                  <option value="toll">Toll</option>
                  <option value="parking">Parking</option>
                  <option value="fuel">Fuel</option>
                  <option value="state_permit">State permit</option>
                </select>
              </div>
              <div>
                <label htmlFor="expenseAmount">Amount ₹</label>
                <input id="expenseAmount" name="amount" required />
              </div>
              <button type="submit">Add</button>
            </form>
          </Card>

          <Card title="After the trip">
            {review ? (
              <Facts
                items={[
                  ["Cleanliness", `${review.cleanliness}/5`],
                  ["Driver", `${review.driverBehaviour}/5`],
                  ["Punctuality", `${review.punctuality}/5`],
                  ["Matched the booking", `${review.matchedBooking}/5`],
                  ["Comment", review.comment ?? "—"],
                ]}
              />
            ) : (
              <form action={addReviewAction} className="inline-form">
                <input type="hidden" name="bookingId" value={booking.id} />
                {[
                  ["cleanliness", "Cleanliness"],
                  ["driverBehaviour", "Driver"],
                  ["punctuality", "Punctuality"],
                  ["matchedBooking", "Matched booking"],
                ].map(([name, label]) => (
                  <div key={name}>
                    <label htmlFor={name}>{label}</label>
                    <input id={name} name={name} type="number" min="1" max="5" defaultValue="5" />
                  </div>
                ))}
                <button type="submit">Save rating</button>
              </form>
            )}

            {disputes.length > 0 ? (
              <ul className="timeline">
                {disputes.map((dispute) => (
                  <li key={dispute.id}>
                    <strong>{dispute.kind}</strong> — {dispute.description}
                    <time>
                      <StatusBadge status={dispute.status} /> ·{" "}
                      {dispute.refundPaise > 0
                        ? `refund ${formatPaise(dispute.refundPaise)}`
                        : "no refund"}
                    </time>
                  </li>
                ))}
              </ul>
            ) : null}

            <details>
              <summary className="small muted">Raise a dispute</summary>
              <form action={openDisputeAction} className="inline-form">
                <input type="hidden" name="bookingId" value={booking.id} />
                <div>
                  <label htmlFor="disputeKind">Kind</label>
                  <select id="disputeKind" name="kind" defaultValue="vehicle_mismatch">
                    <option value="vehicle_mismatch">Vehicle different from booked</option>
                    <option value="ac_not_working">AC not working</option>
                    <option value="driver_conduct">Driver conduct</option>
                    <option value="late_arrival">Late arrival</option>
                    <option value="overcharge">Charged more than quoted</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="disputeDescription">What happened</label>
                  <input id="disputeDescription" name="description" required />
                </div>
                <button type="submit">Open</button>
              </form>
            </details>
          </Card>
        </div>

        <div>
          <Card title="The trip">
            <Facts
              items={[
                [
                  "RFQ",
                  <Link key="r" href={`/rfqs/${request.id}`}>
                    {request.reference}
                  </Link>,
                ],
                ["Departs", formatIst(request.startAt)],
                ["Returns", request.endAt ? formatIst(request.endAt) : "one way"],
                [
                  "Vehicle asked for",
                  `${request.vehicleCount} × ${vehicleClassLabel(request.vehicleClass)}`,
                ],
                ["Passengers", request.passengerCount],
                ["Customer", `${customer.name} · ${maskPhone(customer.phone)}`],
                ["Route", stops.map((stop) => stop.label).join(" → ") || "—"],
              ]}
            />
            <h3>Guest tracking link</h3>
            <p className="small">
              <Link href={`/track/${booking.trackingToken}`}>/track/{booking.trackingToken}</Link>
            </p>
            <p className="muted small">
              No app, no login, works in any browser. For a wedding, sixty guests want to know where
              the bus is — and this page is the best organic acquisition channel Toli has.
            </p>
          </Card>

          <Card title="Invoice">
            {invoice ? (
              <>
                <Facts
                  items={[
                    ["Number", invoice.number],
                    ["Issued", formatIst(invoice.issuedAt)],
                    ["Taxable", <Amount key="tx" paise={invoice.taxablePaise} />],
                    // An invoice shows the split it was raised under: CGST plus
                    // SGST within the state, IGST across it. Never both.
                    ...taxLines(invoice),
                    ["Total", <Amount key="t" paise={invoice.totalPaise} />],
                    ["SAC", invoice.sacCode],
                    ["Place of supply", invoice.placeOfSupply],
                    ["Customer GSTIN", invoice.customerGstin ?? "unregistered"],
                  ]}
                />
                <p className="muted small">{GST_TREATMENTS[invoice.gstTreatment].basis}</p>
              </>
            ) : (
              <>
                <p className="muted small">
                  {GST_TREATMENTS[booking.gstTreatment].label} ·{" "}
                  {booking.intraState ? "CGST + SGST" : "IGST"} · place of supply{" "}
                  {booking.placeOfSupply}
                </p>
                <form action={issueInvoiceAction}>
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <button type="submit">Issue GST invoice</button>
                </form>
              </>
            )}
          </Card>

          <Card title="Settlement">
            <div className="table-wrap">
              <table className="ledger">
                <tbody>
                  {(settlement
                    ? computeSettlement({
                        grossPaise: settlement.grossPaise,
                        commissionBps: booking.commissionBps,
                        tcsBps: settings.tcsBps,
                        tdsBps: settings.tdsBps,
                        expensesReimbursedPaise: settlement.expensesReimbursedPaise,
                        cashCollectedPaise: settlement.cashCollectedPaise,
                      })
                    : projected
                  ).lines.map((line) => (
                    <tr key={line.label}>
                      <td>
                        {line.label}
                        {line.note ? <div className="muted small">{line.note}</div> : null}
                      </td>
                      <td className="right">{formatPaise(line.amountPaise)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Net to {operator.name}</td>
                    <td className="right">
                      {formatPaise(settlement?.netPayablePaise ?? projected.netPayablePaise)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {projected.operatorOwesPlatform && !settlement ? (
              <p className="notice">
                The driver collected more cash than the operator is owed — the balance runs the
                other way, and this is recovered from the next settlement.
              </p>
            ) : null}

            {settlement ? (
              <>
                <p className="small">
                  <StatusBadge status={settlement.status} />
                  {settlement.utr ? ` · UTR ${settlement.utr}` : ""}
                </p>
                {settlement.status === "pending" ? (
                  <>
                    <p className="muted small">
                      Releasable from {formatIst(releaseDueAt(new Date(), operator.tier))} —{" "}
                      {operator.tier} tier.
                    </p>
                    <form action={releaseSettlementAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <button type="submit">Release</button>
                    </form>
                  </>
                ) : settlement.status === "released" ? (
                  <form action={markSettlementPaidAction} className="inline-form">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <div>
                      <label htmlFor="utr">Payout UTR</label>
                      <input id="utr" name="utr" required />
                    </div>
                    <button type="submit">Mark paid</button>
                  </form>
                ) : null}
              </>
            ) : (
              <form action={buildSettlementAction}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <button type="submit">Build settlement</button>
              </form>
            )}
          </Card>

          <Card title="Quote as accepted">
            <Facts
              items={[
                ["Operator", operator.name],
                ["Estimated", <Amount key="e" paise={quote.estimatedTotalPaise} />],
                ["Worst case", <Amount key="w" paise={quote.worstCaseTotalPaise} />],
                ["Min km/day", quote.minKmPerDay ?? "—"],
                ["Toll", quote.tollIncluded ? "included" : "excluded"],
                ["Parking", quote.parkingIncluded ? "included" : "excluded"],
                ["Interstate tax", quote.statePermitIncluded ? "included" : "excluded"],
                ["Commission", formatBps(booking.commissionBps)],
              ]}
            />
          </Card>

          {booking.status !== "cancelled" && booking.status !== "completed" ? (
            <Card title="Cancel">
              <p className="muted small">
                Cancelled now, {cancellation.daysToDeparture} day(s) before departure: charge{" "}
                {formatPaise(cancellation.chargePaise)}, refund{" "}
                {formatPaise(cancellation.refundPaise)}. {cancellation.note}
              </p>
              <form action={cancelBookingAction} className="inline-form">
                <input type="hidden" name="bookingId" value={booking.id} />
                <div>
                  <label htmlFor="reason">Reason</label>
                  <input id="reason" name="reason" required />
                </div>
                <button type="submit" className="danger">
                  Cancel booking
                </button>
              </form>
            </Card>
          ) : booking.cancellationReason ? (
            <Card title="Cancelled">
              <p className="small">
                <Badge tone="stop">cancelled</Badge> {booking.cancellationReason}
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}
