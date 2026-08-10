import Link from "next/link"
import { notFound } from "next/navigation"
import { BookingBadge, Empty, ErrorBanner, Line, PageHead } from "@/components/ui"
import { getBooking, listPayments, moneyPosition } from "@/db/bookings"
import { formatIst, relativeDays } from "@/domain/datetime"
import { formatBps, formatInr } from "@/domain/money"
import { advanceDuePaise, TRIP_TYPE_LABELS } from "@/domain/pricing"
import {
  BOOKING_STATUS_LABELS,
  nextBookingStatuses,
  PAYMENT_KIND_LABELS,
  PAYMENT_KINDS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "@/domain/status"
import { vehicleClassLabel } from "@/domain/vehicles"
import { assignDriverAction, recordPaymentAction, setBookingStatusAction } from "../actions.ts"

export const dynamic = "force-dynamic"

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const found = await getBooking(id)
  if (!found) notFound()

  const { booking, quote, enquiry, operator } = found
  const payments = await listPayments(booking.id)
  const position = moneyPosition(quote, payments)
  const advance = advanceDuePaise(quote.totalPaise)
  const open = booking.status !== "completed" && booking.status !== "cancelled"

  return (
    <main>
      <PageHead
        title={`${enquiry.origin} → ${enquiry.destination}`}
        subtitle={`${booking.ref} · ${formatIst(enquiry.startAt)} IST · ${relativeDays(
          enquiry.startAt,
        )}`}
      >
        <BookingBadge status={booking.status} />
      </PageHead>

      <ErrorBanner message={error} />

      {booking.status === "cancelled" && booking.cancellationReason ? (
        <p role="alert">Cancelled: {booking.cancellationReason}</p>
      ) : null}

      <ul className="stats">
        <li className="stat">
          <div className="stat-value">{formatInr(quote.totalPaise)}</div>
          <div className="stat-label">Customer pays</div>
        </li>
        <li className="stat">
          <div className="stat-value">{formatInr(position.collectedPaise)}</div>
          <div className="stat-label">Collected</div>
          <div className="stat-label">
            {position.dueFromCustomerPaise > 0
              ? `${formatInr(position.dueFromCustomerPaise)} still due`
              : "paid in full"}
          </div>
        </li>
        <li className="stat">
          <div className="stat-value">{formatInr(position.dueToOperatorPaise)}</div>
          <div className="stat-label">Owed to {operator.name}</div>
          <div className="stat-label">{formatInr(position.paidOutPaise)} paid out</div>
        </li>
        <li className="stat">
          <div className="stat-value">{formatInr(quote.commissionPaise)}</div>
          <div className="stat-label">Our commission</div>
          <div className="stat-label">{formatBps(quote.commissionBps)} of the fare</div>
        </li>
      </ul>

      <div className="columns">
        <section className="card">
          <h2>The trip</h2>
          <dl className="lines">
            <Line label="Customer" value={enquiry.customerName} />
            <Line label="Phone" value={enquiry.customerPhone} />
            <Line label="Trip type" value={TRIP_TYPE_LABELS[enquiry.tripType]} />
            <Line label="Days" value={String(enquiry.days)} />
            <Line label="Passengers" value={String(enquiry.passengers)} />
            <Line label="Vehicle" value={vehicleClassLabel(enquiry.vehicleClass)} />
            <Line label="Operator" value={`${operator.name}, ${operator.city}`} />
            <Line label="Operator phone" value={operator.phone} />
            <Line label="Enquiry" value={enquiry.ref} />
          </dl>
          <p className="small">
            <Link href={`/enquiries/${enquiry.id}`}>See the enquiry and every quote on it</Link>
          </p>
        </section>

        <section className="card">
          <h2>The fare</h2>
          <dl className="lines">
            <Line
              label={`${quote.chargeableKm} km × ₹${(quote.perKmPaise / 100).toFixed(2)}/km`}
              value={formatInr(quote.baseFarePaise)}
            />
            <Line label="Driver allowance" value={formatInr(quote.driverAllowancePaise)} />
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
            <Line label="Suggested advance" value={formatInr(advance)} />
            <Line label="Operator receives" value={formatInr(quote.operatorPayoutPaise)} />
          </dl>
        </section>
      </div>

      <div className="columns">
        <section className="card">
          <h2>Driver and vehicle</h2>
          <p className="small muted">
            Filled in shortly before departure — this is what the group is told to look for.
          </p>
          <form action={assignDriverAction}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <div className="form-grid">
              <div>
                <label htmlFor="driverName">Driver</label>
                <input id="driverName" name="driverName" defaultValue={booking.driverName ?? ""} />
              </div>
              <div>
                <label htmlFor="driverPhone">Driver phone</label>
                <input
                  id="driverPhone"
                  name="driverPhone"
                  inputMode="tel"
                  defaultValue={booking.driverPhone ?? ""}
                />
              </div>
              <div>
                <label htmlFor="vehicleRegistration">Registration</label>
                <input
                  id="vehicleRegistration"
                  name="vehicleRegistration"
                  defaultValue={booking.vehicleRegistration ?? ""}
                />
              </div>
              <div className="field-wide">
                <label htmlFor="pickupNote">Pickup note</label>
                <textarea
                  id="pickupNote"
                  name="pickupNote"
                  defaultValue={booking.pickupNote ?? ""}
                  placeholder="Gate 2, opposite the temple, 5.30 am sharp"
                />
              </div>
            </div>
            <button type="submit">Save</button>
          </form>
        </section>

        <section className="card">
          <h2>Move it along</h2>
          {nextBookingStatuses(booking.status).length === 0 ? (
            <p className="muted">
              This booking is {BOOKING_STATUS_LABELS[booking.status].toLowerCase()} and cannot
              change again.
            </p>
          ) : (
            <div className="stack">
              {nextBookingStatuses(booking.status).map((next) => (
                <form key={next} action={setBookingStatusAction} className="inline-form">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="status" value={next} />
                  {next === "cancelled" ? (
                    <div>
                      <label htmlFor="reason">Why</label>
                      <input id="reason" name="reason" placeholder="Group called it off" />
                    </div>
                  ) : null}
                  <button className={next === "cancelled" ? "danger" : undefined} type="submit">
                    {BOOKING_STATUS_LABELS[next]}
                  </button>
                </form>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Money</h2>
        {payments.length === 0 ? (
          <Empty>Nothing has moved yet. The advance is usually collected to hold the vehicle.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.id}>
                    <td className="small">{formatIst(row.at)}</td>
                    <td>
                      {PAYMENT_KIND_LABELS[row.kind]}
                      {row.note ? <div className="small muted">{row.note}</div> : null}
                    </td>
                    <td className="small">{PAYMENT_METHOD_LABELS[row.method]}</td>
                    <td className="small mono">{row.reference ?? "—"}</td>
                    <td className="right mono">{formatInr(row.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {open ? (
          <form action={recordPaymentAction}>
            <h3>Record a payment</h3>
            <input type="hidden" name="bookingId" value={booking.id} />
            <div className="form-grid">
              <div>
                <label htmlFor="kind">What moved</label>
                <select id="kind" name="kind" defaultValue="customer_advance">
                  {PAYMENT_KINDS.map((value) => (
                    <option key={value} value={value}>
                      {PAYMENT_KIND_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="amountRupees">Amount (₹)</label>
                <input
                  id="amountRupees"
                  name="amountRupees"
                  type="number"
                  min="1"
                  step="1"
                  required
                />
              </div>
              <div>
                <label htmlFor="method">Method</label>
                <select id="method" name="method" defaultValue="upi">
                  {PAYMENT_METHODS.map((value) => (
                    <option key={value} value={value}>
                      {PAYMENT_METHOD_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reference">Reference</label>
                <input id="reference" name="reference" placeholder="UTR or UPI reference" />
              </div>
              <div className="field-wide">
                <label htmlFor="note">Note</label>
                <input id="note" name="note" />
              </div>
            </div>
            <button type="submit">Record</button>
          </form>
        ) : null}
      </section>
    </main>
  )
}
