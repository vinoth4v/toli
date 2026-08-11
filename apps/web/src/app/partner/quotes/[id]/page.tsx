import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { shapeOf } from "@/data/demand"
import { operatorFleet, operatorQuote } from "@/data/scoped"
import { formatIst } from "@/domain/format"
import { extraLabel, pricingBasis, tripTypeLabel } from "@/domain/trip"
import { featureLabel, vehicleClassLabel } from "@/domain/vehicle"
import { submitOwnQuoteAction } from "../../actions"

/**
 * Answering one RFQ.
 *
 * The form is the §7.1 schema, and the fields it refuses to let past are the
 * two the plan singles out. That is not bureaucracy aimed at the operator — it
 * is what stops the operator who *does* quote honestly from losing to one who
 * hides a 350 km/day minimum, which is the reason honest operators leave
 * marketplaces.
 */

export const dynamic = "force-dynamic"

export default async function PartnerQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, { error }, session] = await Promise.all([params, searchParams, auth()])
  const operatorId = session?.user.operatorId
  if (!operatorId) redirect("/login")

  const found = await operatorQuote(operatorId, id)
  if (!found) notFound()

  const { quote, request, customerName, stops } = found
  const shape = shapeOf(request)
  const basis = pricingBasis(request.tripType)
  const fleet = await operatorFleet(operatorId)
  const usable = fleet.filter((vehicle) => vehicle.status === "active")

  return (
    <>
      <p className="crumb">
        <Link href="/partner">← Quote inbox</Link>
      </p>

      <div className="quote-workspace">
        <section className="brief">
          <h1>
            {request.city} · {tripTypeLabel(request.tripType)}
          </h1>

          <dl className="brief-facts">
            <div>
              <dt>Leaves</dt>
              <dd>{formatIst(request.startAt)}</dd>
            </div>
            <div>
              <dt>Returns</dt>
              <dd>{request.endAt ? formatIst(request.endAt) : "one way"}</dd>
            </div>
            <div>
              <dt>Days / nights</dt>
              <dd>
                {shape.days} / {shape.nights}
              </dd>
            </div>
            <div>
              <dt>Passengers</dt>
              <dd>{request.passengerCount}</dd>
            </div>
            <div>
              <dt>Vehicle</dt>
              <dd>
                {request.vehicleCount} × {vehicleClassLabel(request.vehicleClass)}
                {request.acRequired ? ", AC" : ", non-AC"}
              </dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd>{request.estimatedKm ? `about ${request.estimatedKm} km` : "not estimated"}</dd>
            </div>
          </dl>

          {request.interstate ? (
            <p className="alert-strip">
              Crosses into {request.statesCrossed.join(", ")} — needs an All India Tourist Permit,
              and the customer will see whether you included the border tax.
            </p>
          ) : null}

          {stops.length > 0 ? (
            <>
              <h3>Route</h3>
              <ol className="brief-route">
                {stops.map((stop) => (
                  <li key={stop.id}>{stop.label}</li>
                ))}
              </ol>
            </>
          ) : null}

          {request.features.length > 0 || request.extras.length > 0 ? (
            <>
              <h3>Asked for</h3>
              <ul className="chip-list">
                {request.features.map((feature) => (
                  <li key={feature} className="chip info">
                    {featureLabel(feature)}
                  </li>
                ))}
                {request.extras.map((extra) => (
                  <li key={extra} className="chip info">
                    {extraLabel(extra)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {request.notes ? (
            <>
              <h3>In their words</h3>
              <p className="said">{request.notes}</p>
            </>
          ) : null}

          <p className="muted small">
            Asked {formatIst(quote.requestedAt)} · {customerName}
          </p>
        </section>

        <section className="price-form">
          <h2>Your price</h2>
          {error ? <p role="alert">{error}</p> : null}

          {quote.status !== "requested" ? (
            <p className="notice">
              You quoted this on {formatIst(quote.submittedAt)}. Submitting again replaces it.
            </p>
          ) : null}

          <form action={submitOwnQuoteAction}>
            <input type="hidden" name="quoteId" value={quote.id} />

            {basis === "distance" ? (
              <>
                <div className="row">
                  <div>
                    <label htmlFor="perKmRate">Rate per km ₹</label>
                    <input id="perKmRate" name="perKmRate" inputMode="decimal" required />
                  </div>
                  <div>
                    <label htmlFor="minKmPerDay">
                      Minimum km per day
                      <span className="hint">
                        Required — the customer sees this next to your price
                      </span>
                    </label>
                    <input
                      id="minKmPerDay"
                      name="minKmPerDay"
                      type="number"
                      min="0"
                      placeholder="300"
                      required
                    />
                  </div>
                </div>
                <div className="row">
                  <div>
                    <label htmlFor="baseFare">Base fare ₹</label>
                    <input id="baseFare" name="baseFare" defaultValue="0" inputMode="decimal" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="row">
                  <div>
                    <label htmlFor="baseFare">Package price ₹</label>
                    <input id="baseFare" name="baseFare" inputMode="decimal" required />
                  </div>
                  <div>
                    <label htmlFor="includedKm">Includes km</label>
                    <input id="includedKm" name="includedKm" type="number" min="0" required />
                  </div>
                  <div>
                    <label htmlFor="includedHours">Includes hours</label>
                    <input id="includedHours" name="includedHours" type="number" min="0" required />
                  </div>
                </div>
                <div className="row">
                  <div>
                    <label htmlFor="extraKmRate">Extra km ₹</label>
                    <input id="extraKmRate" name="extraKmRate" inputMode="decimal" required />
                  </div>
                  <div>
                    <label htmlFor="extraHourRate">Extra hour ₹</label>
                    <input id="extraHourRate" name="extraHourRate" inputMode="decimal" required />
                  </div>
                </div>
              </>
            )}

            <div className="row">
              <div>
                <label htmlFor="driverBata">Driver bata ₹ / day</label>
                <input id="driverBata" name="driverBata" defaultValue="0" inputMode="decimal" />
              </div>
              <div>
                <label htmlFor="nightHalt">
                  Night halt ₹
                  {shape.nights > 0 ? (
                    <span className="hint">{shape.nights} night(s) on this trip</span>
                  ) : null}
                </label>
                <input id="nightHalt" name="nightHalt" defaultValue="0" inputMode="decimal" />
              </div>
              <div>
                <label htmlFor="vehicleId">Which vehicle</label>
                <select id="vehicleId" name="vehicleId" defaultValue="">
                  <option value="">Decide later</option>
                  {usable.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registrationNumber} · {vehicle.seats} seats
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="inclusions">
              <legend>What is included</legend>
              <label htmlFor="tollIncluded">
                <input id="tollIncluded" name="tollIncluded" type="checkbox" />
                Tolls
              </label>
              <label htmlFor="parkingIncluded">
                <input id="parkingIncluded" name="parkingIncluded" type="checkbox" />
                Parking
              </label>
              <label htmlFor="statePermitIncluded">
                <input id="statePermitIncluded" name="statePermitIncluded" type="checkbox" />
                Interstate permit tax
              </label>
              <label htmlFor="fuelIncluded">
                <input id="fuelIncluded" name="fuelIncluded" type="checkbox" defaultChecked />
                Fuel
              </label>
            </fieldset>

            <div>
              <label htmlFor="notes">Note to the customer</label>
              <input id="notes" name="notes" placeholder="Anything they should know" />
            </div>

            <button type="submit">Send this price</button>
          </form>
        </section>
      </div>
    </>
  )
}
