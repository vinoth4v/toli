import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { driverTrips } from "@/data/scoped"
import { formatIstDate, formatIstTime } from "@/domain/format"
import { translations } from "@/i18n"

/**
 * Today.
 *
 * One card per trip, and almost always exactly one. The largest thing on the
 * screen is the time the driver has to be somewhere, because that is the only
 * question this screen exists to answer.
 */

export const dynamic = "force-dynamic"

export default async function DriveHome() {
  const [session, { t }] = await Promise.all([auth(), translations()])
  const driverId = session?.user.driverId
  if (!driverId) redirect("/login")

  const trips = await driverTrips(driverId)
  const running = trips.filter((trip) => trip.status === "in_transit")
  const rest = trips.filter((trip) => trip.status !== "in_transit")

  return (
    <>
      {trips.length === 0 ? (
        <section className="drive-empty">
          <p className="big">{t.driveNoTrip}</p>
          <p>{t.driveNoTripHint}</p>
        </section>
      ) : null}

      {[...running, ...rest].map((trip) => (
        <Link key={trip.bookingId} href={`/drive/${trip.bookingId}`} className="drive-card">
          {trip.status === "in_transit" ? (
            <span className="running">{t.driveTripRunning}</span>
          ) : null}

          <p className="drive-time">{formatIstTime(trip.startAt)}</p>
          <p className="drive-date">{formatIstDate(trip.startAt)}</p>

          <p className="drive-route">
            {trip.stops.length > 0 ? trip.stops[0]?.label : trip.city}
            {trip.stops.length > 1 ? (
              <>
                <span className="arrow">↓</span>
                {trip.stops[trip.stops.length - 1]?.label}
              </>
            ) : null}
          </p>

          <p className="drive-vehicle numeric">{trip.registration}</p>
          <p className="drive-meta">
            {trip.passengerCount} {t.drivePassengers}
            {trip.interstate ? ` · ${t.driveInterstate}` : ""}
          </p>

          <span className="drive-go">{t.driveOpen} →</span>
        </Link>
      ))}
    </>
  )
}
