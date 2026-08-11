import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { customerTrips } from "@/data/scoped"
import { formatIst, relativeToNow } from "@/domain/format"
import { formatPaise } from "@/domain/money"
import { tripTypeLabel } from "@/domain/trip"
import { vehicleClassLabel } from "@/domain/vehicle"
import { translations } from "@/i18n"

export const dynamic = "force-dynamic"

/** Status wording comes from the dictionary, so it changes with the language. */
function stateOf(
  status: string,
  t: { portalWaitingQuotes: string; portalQuotesComing: string; portalBooked: string },
) {
  switch (status) {
    case "open":
      return { label: t.portalWaitingQuotes, tone: "waiting" }
    case "quoting":
      return { label: t.portalQuotesComing, tone: "waiting" }
    case "booked":
      return { label: t.portalBooked, tone: "good" }
    default:
      return { label: status, tone: "quiet" }
  }
}

export default async function PortalHome() {
  const [session, { t }] = await Promise.all([auth(), translations()])
  const customerId = session?.user.customerId
  if (!customerId) redirect("/login")

  const trips = await customerTrips(customerId)
  const upcoming = trips.filter((trip) => trip.request.startAt.getTime() > Date.now())
  const past = trips.filter((trip) => trip.request.startAt.getTime() <= Date.now())

  return (
    <>
      <header className="portal-head">
        <h1>{t.portalYourTrips}</h1>
        <div className="button-row">
          <Link href="/portal/book" className="button-link">
            {t.portalBookNow}
          </Link>
          <Link href="/portal/new" className="button-link quiet">
            {t.portalAskForVehicle}
          </Link>
        </div>
      </header>

      {trips.length === 0 ? (
        <section className="portal-empty">
          <h2>{t.portalNothingYet}</h2>
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
          <h2 className="portal-section">{t.portalComingUp}</h2>
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
                  <span className={`state ${stateOf(request.status, t).tone}`}>
                    {stateOf(request.status, t).label}
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
          <h2 className="portal-section">{t.portalEarlier}</h2>
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
