import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublicTrip } from "@/data/fulfilment"
import { formatIst, relativeToNow } from "@/domain/format"

/**
 * The public tracking page — §4.1.
 *
 * No app install, no login, works in any browser. For a wedding, sixty guests
 * want to know where the bus is, and the plan calls this the best organic
 * acquisition channel Toli has, which is why there is a soft CTA at the
 * bottom and nothing that looks like a signup wall at the top.
 *
 * The token in the URL is the only credential, so the projection behind it is
 * deliberately narrow: no price, no phone number, no operator commission, and
 * no SOS events. A guest sees progress. The ops desk sees everything else.
 */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Where is the vehicle? · Toli",
  robots: { index: false, follow: false },
}

const STATUS_TEXT: Record<string, string> = {
  confirmed: "Booked — vehicle not yet assigned",
  assigned: "Vehicle assigned",
  in_transit: "On the way",
  completed: "Trip completed",
  cancelled: "This trip was cancelled",
}

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const trip = await getPublicTrip(token)
  if (!trip) notFound()

  return (
    <main className="narrow">
      <section className="track-hero">
        <p className="muted small">{trip.reference}</p>
        <p className="status">{STATUS_TEXT[trip.status] ?? trip.status}</p>
        <p className="muted">
          {trip.city} · departs {formatIst(trip.startAt)}
        </p>
        {trip.latest ? (
          <p className="small">
            Last reported {relativeToNow(trip.latest.at)} near{" "}
            <a
              href={`https://www.google.com/maps?q=${trip.latest.lat},${trip.latest.lng}`}
              rel="noreferrer noopener"
              target="_blank"
            >
              {trip.latest.lat}, {trip.latest.lng}
            </a>
          </p>
        ) : (
          <p className="small muted">
            No position reported yet. Tracking begins when the driver starts the trip.
          </p>
        )}
      </section>

      {trip.vehicleRegistration ? (
        <section className="card">
          <h2>Your vehicle</h2>
          <dl className="facts">
            <dt>Vehicle</dt>
            <dd className="numeric">{trip.vehicleRegistration}</dd>
            <dt>Type</dt>
            <dd>{trip.vehicleLabel}</dd>
            <dt>Driver</dt>
            <dd>{trip.driverFirstName}</dd>
            <dt>Operator</dt>
            <dd>{trip.operatorName}</dd>
          </dl>
        </section>
      ) : null}

      {trip.stops.length > 0 ? (
        <section className="card">
          <h2>Route</h2>
          <ul className="timeline">
            {trip.stops.map((stop) => (
              <li key={`${stop.sequence}-${stop.label}`}>{stop.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {trip.events.length > 0 ? (
        <section className="card">
          <h2>Progress</h2>
          <ul className="timeline">
            {trip.events.map((event) => (
              <li key={`${event.kind}-${event.at.toISOString()}`}>
                {event.kind.replace(/_/g, " ")}
                {event.detail ? ` — ${event.detail}` : ""}
                <time>{formatIst(event.at)}</time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <a className="cta" href="/">
        <strong>toli</strong>
        <br />
        <span className="muted small">
          Book a whole van or bus for your whole group — transparent quotes, verified operators,
          live tracking.
        </span>
      </a>
    </main>
  )
}
