import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { customerTrips } from "@/data/scoped"
import { formatIst, relativeToNow } from "@/domain/format"
import { formatPaise } from "@/domain/money"
import { tripTypeLabel } from "@/domain/trip"
import { vehicleClassLabel } from "@/domain/vehicle"

export const dynamic = "force-dynamic"

const STATE: Record<string, { label: string; tone: string }> = {
  open: { label: "Waiting for quotes", tone: "waiting" },
  quoting: { label: "Quotes coming in", tone: "waiting" },
  booked: { label: "Booked", tone: "good" },
  expired: { label: "Expired", tone: "quiet" },
  cancelled: { label: "Cancelled", tone: "quiet" },
}

export default async function PortalHome() {
  const session = await auth()
  const customerId = session?.user.customerId
  if (!customerId) redirect("/login")

  const trips = await customerTrips(customerId)
  const upcoming = trips.filter((trip) => trip.request.startAt.getTime() > Date.now())
  const past = trips.filter((trip) => trip.request.startAt.getTime() <= Date.now())

  return (
    <>
      <header className="portal-head">
        <h1>Your trips</h1>
        <Link href="/portal/new" className="button-link">
          Ask for a vehicle
        </Link>
      </header>

      {trips.length === 0 ? (
        <section className="portal-empty">
          <h2>Nothing booked yet</h2>
          <p>
            Tell us where the group is going and how many of you there are. Operators come back with
            quotes in one shape, so you can actually compare them.
          </p>
          <Link href="/portal/new" className="button-link">
            Start
          </Link>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section>
          <h2 className="portal-section">Coming up</h2>
          <div className="trip-list">
            {upcoming.map(({ request, booking }) => (
              <Link key={request.id} href={`/portal/trips/${request.id}`} className="trip-card">
                <div className="trip-when">
                  <span className="day">
                    {new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                    }).format(request.startAt)}
                  </span>
                  <span className="month">
                    {new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      month: "short",
                    }).format(request.startAt)}
                  </span>
                </div>
                <div className="trip-body">
                  <h3>
                    {request.city} · {tripTypeLabel(request.tripType)}
                  </h3>
                  <p className="muted small">
                    {request.passengerCount} people · {vehicleClassLabel(request.vehicleClass)} ·{" "}
                    {formatIst(request.startAt)}
                  </p>
                  <p className="muted small">{relativeToNow(request.startAt)}</p>
                </div>
                <div className="trip-state">
                  <span className={`state ${STATE[request.status]?.tone ?? "quiet"}`}>
                    {STATE[request.status]?.label ?? request.status}
                  </span>
                  {booking ? (
                    <span className="price">{formatPaise(booking.booking.agreedTotalPaise)}</span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          <h2 className="portal-section">Earlier</h2>
          <div className="trip-list">
            {past.map(({ request, booking }) => (
              <Link
                key={request.id}
                href={`/portal/trips/${request.id}`}
                className="trip-card past"
              >
                <div className="trip-when">
                  <span className="day">
                    {new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                    }).format(request.startAt)}
                  </span>
                  <span className="month">
                    {new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      month: "short",
                    }).format(request.startAt)}
                  </span>
                </div>
                <div className="trip-body">
                  <h3>
                    {request.city} · {tripTypeLabel(request.tripType)}
                  </h3>
                  <p className="muted small">
                    {booking ? `with ${booking.operatorName}` : "no booking"}
                  </p>
                </div>
                <div className="trip-state">
                  {booking ? (
                    <span className="price">{formatPaise(booking.booking.agreedTotalPaise)}</span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
