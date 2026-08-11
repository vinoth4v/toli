import Link from "next/link"
import { LAUNCH_CITIES, STATE_NAMES } from "@/domain/india"
import { TRIP_EXTRAS, TRIP_TYPE_INFO } from "@/domain/trip"
import { VEHICLE_CLASS_INFO, VEHICLE_FEATURES } from "@/domain/vehicle"
import { createOwnRequestAction } from "../actions"

/**
 * Asking for a vehicle, in the words a passenger would use.
 *
 * The same fields the ops desk collects — the quote schema depends on them —
 * but every label is written for someone doing this once. "States crossed"
 * explains why it is being asked; "estimated km" says it is fine to guess.
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
      <p className="crumb">
        <Link href="/portal">← Your trips</Link>
      </p>

      <header className="portal-head">
        <div>
          <h1>Where is the group going?</h1>
          <p className="muted">
            The more of this you fill in, the fewer questions come back — and the closer the quotes
            are to what you will actually pay.
          </p>
        </div>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <form action={createOwnRequestAction} className="ask-form">
        <fieldset>
          <legend>The trip</legend>
          <div className="row">
            <div>
              <label htmlFor="tripType">What kind of trip</label>
              <select id="tripType" name="tripType" defaultValue="round_trip" required>
                {Object.values(TRIP_TYPE_INFO).map((info) => (
                  <option key={info.key} value={info.key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="city">Starting from</label>
              <input id="city" name="city" list="cities" defaultValue="Jaipur" required />
              <datalist id="cities">
                {LAUNCH_CITIES.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="state">In which state</label>
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
              <label htmlFor="startAt">Leaving</label>
              <input id="startAt" name="startAt" type="datetime-local" required />
            </div>
            <div>
              <label htmlFor="endAt">
                Coming back
                <span className="hint">Leave blank for one way</span>
              </label>
              <input id="endAt" name="endAt" type="datetime-local" />
            </div>
            <div>
              <label htmlFor="estimatedKm">
                Roughly how far
                <span className="hint">A guess is fine — total kilometres, both ways</span>
              </label>
              <input id="estimatedKm" name="estimatedKm" type="number" min="0" step="10" />
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="stop0">Pick up at</label>
              <input id="stop0" name="stops" placeholder="Hotel Clarks Amer, Jaipur" />
            </div>
            <div>
              <label htmlFor="stop1">Stopping at</label>
              <input id="stop1" name="stops" />
            </div>
            <div>
              <label htmlFor="stop2">Ending at</label>
              <input id="stop2" name="stops" placeholder="Taj East Gate, Agra" />
            </div>
          </div>

          <div>
            <label htmlFor="statesCrossed">
              Does the trip cross into another state?
              <span className="hint">
                If it does, the vehicle needs an All India Tourist Permit and there is a border tax.
                Naming the states here means every quote has to say whether that tax is included —
                which is the charge people most often get surprised by.
              </span>
            </label>
            <select id="statesCrossed" name="statesCrossed" multiple size={5}>
              {STATE_NAMES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset>
          <legend>The group</legend>
          <div className="row">
            <div>
              <label htmlFor="passengerCount">How many people</label>
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
              <label htmlFor="vehicleClass">What sort of vehicle</label>
              <select id="vehicleClass" name="vehicleClass" defaultValue="tempo_traveller" required>
                {Object.values(VEHICLE_CLASS_INFO).map((info) => (
                  <option key={info.key} value={info.key}>
                    {info.label} — {info.seatOptions.join("/")} seats
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="vehicleCount">How many vehicles</label>
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
              Air conditioned
            </label>
            {VEHICLE_FEATURES.map((feature) => (
              <label key={feature.key} htmlFor={`f-${feature.key}`}>
                <input
                  id={`f-${feature.key}`}
                  name="features"
                  type="checkbox"
                  value={feature.key}
                />
                {feature.label}
              </label>
            ))}
          </div>

          <h3>Anything else</h3>
          <div className="checks">
            {TRIP_EXTRAS.map((extra) => (
              <label key={extra.key} htmlFor={`e-${extra.key}`}>
                <input id={`e-${extra.key}`} name="extras" type="checkbox" value={extra.key} />
                {extra.label}
              </label>
            ))}
          </div>

          <div>
            <label htmlFor="notes">
              In your own words
              <span className="hint">
                Anything an operator should know — elderly passengers, a lot of luggage, a temple
                stop on the way
              </span>
            </label>
            <textarea id="notes" name="notes" />
          </div>
        </fieldset>

        <button type="submit">Send to operators</button>
      </form>
    </>
  )
}
