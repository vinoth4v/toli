import Link from "next/link"
import { Card, PageHead } from "@/components/ui"
import { LAUNCH_CITIES, STATE_NAMES } from "@/domain/india"
import { TRIP_EXTRAS, TRIP_TYPE_INFO } from "@/domain/trip"
import { VEHICLE_CLASS_INFO, VEHICLE_FEATURES } from "@/domain/vehicle"
import { LANGUAGE_LABEL, LOCALES } from "@/i18n"
import { createRequestAction } from "../actions"

/**
 * The requirement builder — §4.1 calls it the most important screen in the
 * product, and this is the ops desk's version of it: the same fields the
 * customer app will collect, filled in by whoever took the phone call.
 *
 * The structure is the point. Every field here is one an operator would
 * otherwise have to ask about on WhatsApp, and every answer is one that makes
 * the resulting quotes comparable.
 */

export const dynamic = "force-dynamic"

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <>
      <PageHead
        title="New RFQ"
        intro="Everything an operator needs to quote without a phone call back. Fields left vague here become the arguments that happen at the end of the trip."
        actions={
          <Link href="/console/rfqs">
            <button type="button" className="quiet">
              Back to the desk
            </button>
          </Link>
        }
      />

      {error ? <p role="alert">{error}</p> : null}

      <form action={createRequestAction}>
        <div className="split">
          <div>
            <Card title="Who is asking">
              <div className="row">
                <div>
                  <label htmlFor="customerName">Name</label>
                  <input id="customerName" name="customerName" required />
                </div>
                <div>
                  <label htmlFor="customerPhone">
                    Phone
                    <span className="hint">The identity in this market — one per customer</span>
                  </label>
                  <input id="customerPhone" name="customerPhone" required />
                </div>
              </div>
              <div className="row">
                <div>
                  <label htmlFor="customerEmail">Email</label>
                  <input id="customerEmail" name="customerEmail" type="email" />
                </div>
                <div>
                  <label htmlFor="customerGstin">
                    GSTIN
                    <span className="hint">Corporates cannot expense a trip without it</span>
                  </label>
                  <input id="customerGstin" name="customerGstin" />
                </div>
                <div>
                  <label htmlFor="segment">Segment</label>
                  <select id="segment" name="segment" defaultValue="">
                    <option value="">—</option>
                    <option value="wedding">Wedding</option>
                    <option value="corporate">Corporate</option>
                    <option value="pilgrimage">Pilgrimage</option>
                    <option value="school">School</option>
                    <option value="tourism">Tourism</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card title="The trip">
              <div className="row">
                <div>
                  <label htmlFor="tripType">Trip type</label>
                  <select id="tripType" name="tripType" defaultValue="round_trip" required>
                    {Object.values(TRIP_TYPE_INFO).map((info) => (
                      <option key={info.key} value={info.key}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="city">Origin city</label>
                  <input id="city" name="city" list="cities" defaultValue="Jaipur" required />
                  <datalist id="cities">
                    {LAUNCH_CITIES.map((city) => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="state">
                    Origin state
                    <span className="hint">Decides the place of supply on the invoice</span>
                  </label>
                  <select id="state" name="state" defaultValue="Rajasthan" required>
                    {STATE_NAMES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row">
                <div>
                  <label htmlFor="startAt">Departure</label>
                  <input id="startAt" name="startAt" type="datetime-local" required />
                </div>
                <div>
                  <label htmlFor="endAt">
                    Return
                    <span className="hint">Blank for a one-way trip</span>
                  </label>
                  <input id="endAt" name="endAt" type="datetime-local" />
                </div>
                <div>
                  <label htmlFor="estimatedKm">
                    Estimated km
                    <span className="hint">Total running, both ways</span>
                  </label>
                  <input id="estimatedKm" name="estimatedKm" type="number" min="0" step="10" />
                </div>
              </div>

              <div className="row">
                <div>
                  <label htmlFor="stop0">Pickup</label>
                  <input id="stop0" name="stops" placeholder="Hotel Clarks Amer, Jaipur" />
                </div>
                <div>
                  <label htmlFor="stop1">Stop</label>
                  <input id="stop1" name="stops" placeholder="Fatehpur Sikri" />
                </div>
                <div>
                  <label htmlFor="stop2">Stop</label>
                  <input id="stop2" name="stops" />
                </div>
                <div>
                  <label htmlFor="stop3">Drop</label>
                  <input id="stop3" name="stops" placeholder="Taj East Gate, Agra" />
                </div>
              </div>

              <div>
                <label htmlFor="statesCrossed">
                  States crossed
                  <span className="hint">
                    Naming one makes this an interstate trip: an All India Tourist Permit becomes
                    mandatory, and permit tax becomes a quote field the customer can see
                  </span>
                </label>
                <select id="statesCrossed" name="statesCrossed" multiple size={6}>
                  {STATE_NAMES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            <Card title="The group">
              <div className="row">
                <div>
                  <label htmlFor="passengerCount">Passengers</label>
                  <input
                    id="passengerCount"
                    name="passengerCount"
                    type="number"
                    min="1"
                    defaultValue="20"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="vehicleClass">Vehicle class</label>
                  <select
                    id="vehicleClass"
                    name="vehicleClass"
                    defaultValue="tempo_traveller"
                    required
                  >
                    {Object.values(VEHICLE_CLASS_INFO).map((info) => (
                      <option key={info.key} value={info.key}>
                        {info.label} ({info.seatOptions.join("/")} seats)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="driverLanguage">
                    Driver language
                    <span className="hint">What the caller asked for, if they asked</span>
                  </label>
                  <select id="driverLanguage" name="driverLanguage" defaultValue="">
                    <option value="">No preference</option>
                    {LOCALES.map((code) => (
                      <option key={code} value={code}>
                        {LANGUAGE_LABEL[code]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="vehicleCount">Vehicles</label>
                  <input
                    id="vehicleCount"
                    name="vehicleCount"
                    type="number"
                    min="1"
                    defaultValue="1"
                    required
                  />
                </div>
              </div>

              <div className="checks">
                <label htmlFor="acRequired">
                  <input id="acRequired" name="acRequired" type="checkbox" defaultChecked />
                  AC required
                </label>
                {VEHICLE_FEATURES.map((feature) => (
                  <label key={feature.key} htmlFor={`feature-${feature.key}`}>
                    <input
                      id={`feature-${feature.key}`}
                      name="features"
                      type="checkbox"
                      value={feature.key}
                    />
                    {feature.label}
                  </label>
                ))}
              </div>

              <h3>Extras</h3>
              <div className="checks">
                {TRIP_EXTRAS.map((extra) => (
                  <label key={extra.key} htmlFor={`extra-${extra.key}`}>
                    <input
                      id={`extra-${extra.key}`}
                      name="extras"
                      type="checkbox"
                      value={extra.key}
                    />
                    {extra.label}
                  </label>
                ))}
              </div>

              <div>
                <label htmlFor="notes">
                  Notes
                  <span className="hint">
                    What the customer said in their own words — the thing a form never captures
                  </span>
                </label>
                <textarea id="notes" name="notes" />
              </div>

              <div className="button-row">
                <button type="submit">Create RFQ</button>
              </div>
            </Card>
          </div>

          <div>
            <Card title="Seating guide">
              <p className="muted small">
                Seat counts that exist in this market. A group of 14 does not fit a 13-seater, and a
                26-seater for the same group is a quote 40% too expensive.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Seats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(VEHICLE_CLASS_INFO).map((info) => (
                      <tr key={info.key}>
                        <td>
                          {info.label}
                          <div className="muted small">{info.typicalUse}</div>
                        </td>
                        <td>{info.seatOptions.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Trip types">
              <ul className="timeline">
                {Object.values(TRIP_TYPE_INFO).map((info) => (
                  <li key={info.key}>
                    {info.label}
                    <time>{info.hint}</time>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </form>
    </>
  )
}
