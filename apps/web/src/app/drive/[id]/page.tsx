import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { driverTrips } from "@/data/scoped"
import { formatIstTime } from "@/domain/format"
import { translations } from "@/i18n"
import {
  addTripExpenseAction,
  completeTripAction,
  reachedStopAction,
  sosAction,
  startTripAction,
} from "../actions"
import { ShareLocation } from "../share-location"

/**
 * One trip, for the person driving it.
 *
 * The screen changes shape with the trip: before it starts there is one button
 * and it says Start. Once running, the buttons are the things that happen on a
 * road — reached a stop, paid a toll, finished. Nothing is ever more than one
 * tap away, and nothing on this page mentions what the trip is worth.
 */

export const dynamic = "force-dynamic"

export default async function DriveTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, { error }, session, { t }] = await Promise.all([
    params,
    searchParams,
    auth(),
    translations(),
  ])
  const driverId = session?.user.driverId
  if (!driverId) redirect("/login")

  const trips = await driverTrips(driverId)
  const trip = trips.find((entry) => entry.bookingId === id)
  if (!trip) notFound()

  const started = trip.events.some((event) => event.kind === "started")
  const finished = trip.status === "completed"

  return (
    <>
      <p className="crumb">
        <Link href="/drive">← {t.back}</Link>
      </p>

      {error ? <p role="alert">{error}</p> : null}

      <section className="drive-hero">
        <p className="drive-time">{formatIstTime(trip.startAt)}</p>
        <p className="drive-vehicle numeric">{trip.registration}</p>
        <p className="drive-meta">
          {trip.passengerCount} {t.drivePassengers} · {trip.seats} {t.driveSeats}
          {trip.interstate ? ` · ${t.driveInterstate}` : ""}
        </p>
      </section>

      <section className="drive-route-list">
        {trip.stops.map((stop, index) => (
          <div key={`${stop.sequence}-${stop.label}`} className="drive-stop">
            <span className="dot">{index + 1}</span>
            <span>{stop.label}</span>
          </div>
        ))}
      </section>

      {trip.notes ? (
        <section className="drive-note">
          <p className="label">{t.driveFromCustomer}</p>
          <p>{trip.notes}</p>
        </section>
      ) : null}

      <section className="drive-share">
        <ShareLocation bookingId={trip.bookingId} label={t.driveShareLocation} />
      </section>

      <section className="drive-contact">
        <a href={`tel:+91${trip.customerPhone.replace(/\D/g, "").slice(-10)}`} className="call">
          {t.driveCall} {trip.customerName}
        </a>
      </section>

      {!started ? (
        <form action={startTripAction} className="drive-form">
          <input type="hidden" name="bookingId" value={trip.bookingId} />
          <label htmlFor="odometerKm">{t.driveOdometerNow}</label>
          <input
            id="odometerKm"
            name="odometerKm"
            type="number"
            inputMode="numeric"
            placeholder="184220"
            required
          />
          <button type="submit" className="huge go">
            {t.driveStartTrip}
          </button>
        </form>
      ) : null}

      {started && !finished ? (
        <>
          <form action={reachedStopAction} className="drive-form">
            <input type="hidden" name="bookingId" value={trip.bookingId} />
            <label htmlFor="label">{t.driveReachedStop}</label>
            <select id="label" name="label">
              {trip.stops.map((stop) => (
                <option key={stop.sequence} value={stop.label}>
                  {stop.label}
                </option>
              ))}
            </select>
            <button type="submit" className="huge">
              {t.driveReached}
            </button>
          </form>

          <form action={addTripExpenseAction} className="drive-form">
            <input type="hidden" name="bookingId" value={trip.bookingId} />
            <label htmlFor="kind">{t.driveMoneyPaid}</label>
            <select id="kind" name="kind" defaultValue="toll">
              <option value="toll">{t.driveToll}</option>
              <option value="parking">{t.driveParking}</option>
              <option value="fuel">{t.driveFuel}</option>
              <option value="state_permit">{t.drivePermit}</option>
            </select>
            <input name="amount" inputMode="decimal" placeholder="₹" required />
            <button type="submit" className="huge">
              {t.driveAdd}
            </button>
            <p className="hint">{t.driveExpenseHint}</p>
          </form>

          <form action={completeTripAction} className="drive-form">
            <input type="hidden" name="bookingId" value={trip.bookingId} />
            <label htmlFor="endOdometer">{t.driveOdometerEnd}</label>
            <input id="endOdometer" name="odometerKm" type="number" inputMode="numeric" required />
            <button type="submit" className="huge done">
              {t.driveFinishTrip}
            </button>
          </form>
        </>
      ) : null}

      {finished ? <p className="drive-finished">{t.driveFinished}</p> : null}

      <form action={sosAction} className="drive-sos">
        <input type="hidden" name="bookingId" value={trip.bookingId} />
        <input name="detail" placeholder={t.driveSosPlaceholder} />
        <button type="submit" className="huge sos">
          {t.driveSos}
        </button>
        <p className="hint">{t.driveSosHint}</p>
      </form>

      {trip.events.length > 0 ? (
        <section className="drive-log">
          {trip.events.map((event) => (
            <p key={`${event.kind}-${event.at.toISOString()}`}>
              <span>{formatIstTime(event.at)}</span> {event.kind.replace(/_/g, " ")}
              {event.detail ? ` — ${event.detail}` : ""}
            </p>
          ))}
        </section>
      ) : null}
    </>
  )
}
