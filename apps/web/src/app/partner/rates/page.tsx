import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { ratesFor } from "@/data/rates"
import { operatorFleet } from "@/data/scoped"
import { formatIst } from "@/domain/format"
import { formatPaise } from "@/domain/money"
import { SEGMENT_INFO, SEGMENTS } from "@/domain/segment"
import { VEHICLE_CLASS_INFO, vehicleClassLabel } from "@/domain/vehicle"
import { saveRateAction, toggleRateAction } from "../actions"

/**
 * Standing prices, edited by the operator who owns them.
 *
 * §4.2's argument for this is response rate: a rate card quotes on the
 * operator's behalf while they are on a road somewhere, and response rate is
 * the metric §13 says everything else depends on. It is also the only way a
 * vehicle appears in Book now — no card, no instant booking.
 *
 * The fields are §7.1's, deliberately, so a standing price and a typed quote
 * are the same shape and a customer can compare them without knowing which
 * they are looking at.
 */

export const dynamic = "force-dynamic"

export default async function PartnerRates({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const [{ error, saved }, session] = await Promise.all([searchParams, auth()])
  const operatorId = session?.user.operatorId
  if (!operatorId) redirect("/login")

  const [rates, fleet] = await Promise.all([ratesFor(operatorId), operatorFleet(operatorId)])

  // Only offer combinations this operator could actually serve.
  const combinations = Array.from(
    new Map(
      fleet
        .filter((vehicle) => vehicle.status !== "retired")
        .map((vehicle) => [`${vehicle.segment}:${vehicle.vehicleClass}`, vehicle]),
    ).values(),
  )

  const priced = new Set(rates.map((rate) => `${rate.segment}:${rate.vehicleClass}`))
  const unpriced = combinations.filter(
    (vehicle) => !priced.has(`${vehicle.segment}:${vehicle.vehicleClass}`),
  )

  return (
    <>
      <header className="partner-head">
        <div>
          <h1>Standing rates</h1>
          <p className="muted small">
            Set a price once and Toli quotes for you while you are driving. Vehicles without a rate
            never appear in Book now — customers only see what can be booked immediately.
          </p>
        </div>
        <dl className="partner-stats">
          <div>
            <dt>Priced</dt>
            <dd>{rates.filter((rate) => rate.active).length}</dd>
          </div>
          <div>
            <dt>Unpriced</dt>
            <dd className={unpriced.length > 0 ? "urgent" : ""}>{unpriced.length}</dd>
          </div>
        </dl>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {saved ? <p className="notice">Saved. Vehicles at that rate are bookable now.</p> : null}

      {unpriced.length > 0 ? (
        <p className="notice">
          {unpriced.length} of your vehicle types have no standing price, so they can only be booked
          through a quote. Adding one below makes them instantly bookable.
        </p>
      ) : null}

      {rates.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Segment</th>
                <th>Vehicle</th>
                <th className="right">Per km</th>
                <th className="right">Min km/day</th>
                <th className="right">Bata</th>
                <th className="right">Night halt</th>
                <th>Included</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id}>
                  <td>{SEGMENT_INFO[rate.segment].label}</td>
                  <td>{vehicleClassLabel(rate.vehicleClass)}</td>
                  <td className="right numeric">{formatPaise(rate.perKmRatePaise)}</td>
                  <td className="right numeric">{rate.minKmPerDay}</td>
                  <td className="right numeric">{formatPaise(rate.driverBataPerDayPaise)}</td>
                  <td className="right numeric">{formatPaise(rate.nightHaltPaise)}</td>
                  <td className="small">
                    {[
                      rate.tollIncluded ? "toll" : null,
                      rate.parkingIncluded ? "parking" : null,
                      rate.statePermitIncluded ? "permit" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "nothing"}
                  </td>
                  <td className="small">{formatIst(rate.updatedAt)}</td>
                  <td>
                    <form action={toggleRateAction}>
                      <input type="hidden" name="rateId" value={rate.id} />
                      <input type="hidden" name="active" value={rate.active ? "off" : "on"} />
                      <button type="submit" className="quiet">
                        {rate.active ? "Withdraw" : "Reinstate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          No standing rates yet. Until you add one, your vehicles can only be booked by quote.
        </p>
      )}

      <section className="price-form">
        <h2>Set a rate</h2>
        <form action={saveRateAction}>
          <div className="row">
            <div>
              <label htmlFor="segment">Segment</label>
              <select id="segment" name="segment" defaultValue={unpriced[0]?.segment ?? "premium"}>
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {SEGMENT_INFO[segment].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="vehicleClass">Vehicle type</label>
              <select
                id="vehicleClass"
                name="vehicleClass"
                defaultValue={unpriced[0]?.vehicleClass ?? "tempo_traveller"}
              >
                {Object.values(VEHICLE_CLASS_INFO).map((info) => (
                  <option key={info.key} value={info.key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="perKmRate">Rate per km ₹</label>
              <input id="perKmRate" name="perKmRate" inputMode="decimal" required />
            </div>
            <div>
              <label htmlFor="minKmPerDay">
                Minimum km per day
                <span className="hint">The customer sees this beside your price</span>
              </label>
              <input id="minKmPerDay" name="minKmPerDay" type="number" min="0" required />
            </div>
            <div>
              <label htmlFor="baseFare">Base fare ₹</label>
              <input id="baseFare" name="baseFare" defaultValue="0" inputMode="decimal" />
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="driverBata">Driver bata ₹ / day</label>
              <input id="driverBata" name="driverBata" defaultValue="0" inputMode="decimal" />
            </div>
            <div>
              <label htmlFor="nightHalt">Night halt ₹</label>
              <input id="nightHalt" name="nightHalt" defaultValue="0" inputMode="decimal" />
            </div>
          </div>

          <fieldset className="inclusions">
            <legend>What this price includes</legend>
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
          </fieldset>

          <button type="submit">Save rate</button>
        </form>
      </section>
    </>
  )
}
