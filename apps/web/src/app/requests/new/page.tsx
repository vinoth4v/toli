import { auth } from "@/auth"
import { Card } from "@/components/bits"
import { Shell } from "@/components/shell"
import { createRequestAction } from "@/app/requests/actions"
import { SEGMENTS, VEHICLE_KINDS } from "@/lib/catalog"

export const dynamic = "force-dynamic"

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [session, { error }] = await Promise.all([auth(), searchParams])

  return (
    <Shell email={session?.user?.email}>
      <div className="page-head">
        <div>
          <h1>New requirement</h1>
          <p className="lede">
            What the group needs, in the shape every operator will be asked to answer. The
            kilometre estimate is the desk&rsquo;s, not theirs — it is what makes their quotes
            comparable.
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert">
          Something in that form was not usable — check the dates, the passenger count and the
          kilometre estimate.
        </p>
      ) : null}

      <Card>
        <form action={createRequestAction} className="form-grid">
          <fieldset>
            <legend>Who is travelling</legend>
            <label htmlFor="customerName">Contact name</label>
            <input id="customerName" name="customerName" required />

            <label htmlFor="customerPhone">Phone</label>
            <input id="customerPhone" name="customerPhone" inputMode="tel" required />

            <label htmlFor="customerEmail">Email (optional)</label>
            <input id="customerEmail" name="customerEmail" type="email" />

            <label htmlFor="segment">Occasion</label>
            <select id="segment" name="segment" defaultValue="wedding" required>
              {SEGMENTS.map((segment) => (
                <option key={segment.value} value={segment.value}>
                  {segment.label}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset>
            <legend>The trip</legend>
            <label htmlFor="fromCity">Starting city</label>
            <input id="fromCity" name="fromCity" placeholder="Jaipur" required />

            <label htmlFor="itinerary">Itinerary</label>
            <textarea
              id="itinerary"
              name="itinerary"
              rows={3}
              placeholder="Jaipur → Pushkar → Ajmer → Jaipur, guest ferrying on day 2"
              required
            />

            <label htmlFor="startDate">First day</label>
            <input id="startDate" name="startDate" type="date" required />

            <label htmlFor="endDate">Last day</label>
            <input id="endDate" name="endDate" type="date" required />

            <label htmlFor="estimatedKm">Estimated running kilometres</label>
            <input
              id="estimatedKm"
              name="estimatedKm"
              inputMode="numeric"
              placeholder="1200"
              required
            />
          </fieldset>

          <fieldset>
            <legend>What it takes</legend>
            <label htmlFor="passengers">Passengers</label>
            <input id="passengers" name="passengers" inputMode="numeric" required />

            <label htmlFor="vehicleKind">Vehicle class</label>
            <select id="vehicleKind" name="vehicleKind" defaultValue="tempo_traveller" required>
              {VEHICLE_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label} · about {kind.typicalSeats} seats
                </option>
              ))}
            </select>

            <label htmlFor="vehiclesNeeded">Vehicles needed</label>
            <input id="vehiclesNeeded" name="vehiclesNeeded" inputMode="numeric" defaultValue="1" required />

            <label htmlFor="notes">Anything else (optional)</label>
            <textarea id="notes" name="notes" rows={2} placeholder="4 AM pickup, luggage carrier" />
          </fieldset>

          <div className="form-actions">
            <button type="submit">Post the requirement</button>
          </div>
        </form>
      </Card>
    </Shell>
  )
}
