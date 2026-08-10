import Link from "next/link"
import { ErrorBanner, PageHead } from "@/components/ui"
import { toIstLocalInput } from "@/domain/datetime"
import { TRIP_TYPE_LABELS, TRIP_TYPES } from "@/domain/pricing"
import { RATE_CARDS, VEHICLE_CLASSES } from "@/domain/vehicles"
import { createEnquiryAction } from "../actions.ts"

export const dynamic = "force-dynamic"

/**
 * Taking an enquiry, usually while the customer is still on the phone.
 *
 * Every field is one they can answer without looking anything up. Distance is
 * asked for rather than routed (§6) — see Known gaps; the person taking the
 * call knows Chennai to Tirupati is about 300 km round trip, and waiting on a
 * maps integration would have meant no app at all.
 */
export default async function NewEnquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  // Tomorrow morning: the common case, and a date already in the past is the
  // one value that guarantees a second pass over the form.
  const defaultStart = toIstLocalInput(new Date(Date.now() + 86_400_000))

  return (
    <main>
      <PageHead title="Take an enquiry" subtitle="Who is going where, and when.">
        <Link href="/enquiries">
          <button className="secondary" type="button">
            Back
          </button>
        </Link>
      </PageHead>

      <ErrorBanner message={error} />

      <form action={createEnquiryAction} className="card">
        <fieldset>
          <legend>Customer</legend>
          <div className="form-grid">
            <div>
              <label htmlFor="customerName">Name</label>
              <input id="customerName" name="customerName" required />
            </div>
            <div>
              <label htmlFor="customerPhone">Phone</label>
              <input id="customerPhone" name="customerPhone" inputMode="tel" required />
            </div>
            <div>
              <label htmlFor="customerEmail">Email</label>
              <input id="customerEmail" name="customerEmail" type="email" />
              <span className="hint">Optional — the quote can go by WhatsApp.</span>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Trip</legend>
          <div className="form-grid">
            <div>
              <label htmlFor="origin">From</label>
              <input id="origin" name="origin" placeholder="Chennai" required />
            </div>
            <div>
              <label htmlFor="destination">To</label>
              <input id="destination" name="destination" placeholder="Tirupati" required />
            </div>
            <div>
              <label htmlFor="tripType">Trip type</label>
              <select id="tripType" name="tripType" defaultValue="round_trip">
                {TRIP_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {TRIP_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="startAt">Leaves (IST)</label>
              <input
                id="startAt"
                name="startAt"
                type="datetime-local"
                defaultValue={defaultStart}
                required
              />
            </div>
            <div>
              <label htmlFor="days">Days</label>
              <input id="days" name="days" type="number" min="1" max="60" defaultValue="1" />
              <span className="hint">Calendar days the vehicle is engaged.</span>
            </div>
            <div>
              <label htmlFor="estimatedKm">Distance (km)</label>
              <input id="estimatedKm" name="estimatedKm" type="number" min="1" required />
              <span className="hint">Whole trip, both legs.</span>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Vehicle</legend>
          <div className="form-grid">
            <div>
              <label htmlFor="passengers">Passengers</label>
              <input id="passengers" name="passengers" type="number" min="1" max="200" required />
            </div>
            <div>
              <label htmlFor="vehicleClass">Class wanted</label>
              <select id="vehicleClass" name="vehicleClass" defaultValue="tempo_traveller">
                {VEHICLE_CLASSES.map((value) => (
                  <option key={value} value={value}>
                    {RATE_CARDS[value].label} — seats {RATE_CARDS[value].seats}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-wide">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" placeholder="Wheelchair access, luggage, stops…" />
            </div>
          </div>
        </fieldset>

        <button type="submit">Save enquiry</button>
      </form>
    </main>
  )
}
