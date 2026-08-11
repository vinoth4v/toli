import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { findOffers } from "@/data/availability"
import { tollNotice } from "@/domain/bill"
import { formatIst, fromIstInputValue } from "@/domain/format"
import { LAUNCH_CITIES } from "@/domain/india"
import { formatPaise } from "@/domain/money"
import { SEGMENT_INFO, SEGMENTS, type Segment } from "@/domain/segment"
import { featureLabel, vehicleClassLabel } from "@/domain/vehicle"
import { LANGUAGE_LABEL, LOCALES } from "@/i18n"
import { bookInstantAction } from "../actions"

/**
 * Book now — Lane B.
 *
 * The habit this serves is the one every ride-hailing app taught: say where
 * and when, see what is actually free, and take it. No fan-out, no waiting for
 * three operators to reply, no negotiation. §11 puts this after Lane A for a
 * reason — it only works once there are standing rate cards to quote from —
 * but for the trips it covers it is the whole product.
 *
 * What is shown is what can be booked. A vehicle whose permit lapses before
 * the travel date, or that is already out that morning, never appears: being
 * refused after choosing is worse than never seeing it.
 */

export const dynamic = "force-dynamic"

function isSegment(value: string | undefined): value is Segment {
  return value !== undefined && (SEGMENTS as readonly string[]).includes(value)
}

export default async function BookNowPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string
    segment?: string
    passengers?: string
    startAt?: string
    endAt?: string
    km?: string
    error?: string
    driverLanguage?: string
  }>
}) {
  const [params, session] = await Promise.all([searchParams, auth()])
  if (!session?.user.customerId) redirect("/login")

  const city = params.city ?? "Madurai"
  const segment: Segment = isSegment(params.segment) ? params.segment : "premium"
  const passengers = Number(params.passengers ?? "12") || 12
  const estimatedKm = Number(params.km ?? "0") || 0
  const searched = Boolean(params.startAt)

  const offers = searched
    ? await findOffers({
        city,
        segment,
        passengers,
        startAt: fromIstInputValue(params.startAt as string),
        endAt: params.endAt ? fromIstInputValue(params.endAt) : null,
        estimatedKm,
        interstate: false,
        stateCount: 0,
        driverLanguage: params.driverLanguage ?? null,
      })
    : []

  return (
    <>
      <p className="crumb">
        <Link href="/portal">← Your trips</Link>
      </p>

      <header className="portal-head">
        <div>
          <h1>Book now</h1>
          <p className="muted">
            Vehicles that are free, road-legal on your date, and priced at their operator's standing
            rate. Pick one and it is yours — no waiting for quotes.
          </p>
        </div>
      </header>

      {params.error ? <p role="alert">{params.error}</p> : null}

      <form method="get" className="search-bar">
        <div>
          <label htmlFor="city">From</label>
          <select id="city" name="city" defaultValue={city}>
            {LAUNCH_CITIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="startAt">Leaving</label>
          <input
            id="startAt"
            name="startAt"
            type="datetime-local"
            defaultValue={params.startAt ?? ""}
            required
          />
        </div>
        <div>
          <label htmlFor="endAt">Back</label>
          <input id="endAt" name="endAt" type="datetime-local" defaultValue={params.endAt ?? ""} />
        </div>
        <div>
          <label htmlFor="passengers">People</label>
          <input
            id="passengers"
            name="passengers"
            type="number"
            min="1"
            defaultValue={passengers}
            required
          />
        </div>
        <div>
          <label htmlFor="driverLanguage">Driver speaks</label>
          <select
            id="driverLanguage"
            name="driverLanguage"
            defaultValue={params.driverLanguage ?? ""}
          >
            <option value="">Any</option>
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_LABEL[code]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="km">Approx km</label>
          <input
            id="km"
            name="km"
            type="number"
            min="0"
            step="10"
            defaultValue={estimatedKm || ""}
          />
        </div>
        <button type="submit">Show vehicles</button>
      </form>

      <div className="segment-picker">
        {SEGMENTS.map((option) => {
          const info = SEGMENT_INFO[option]
          const query = new URLSearchParams({
            city,
            segment: option,
            passengers: String(passengers),
            km: String(estimatedKm),
            ...(params.startAt ? { startAt: params.startAt } : {}),
            ...(params.endAt ? { endAt: params.endAt } : {}),
          })

          return (
            <Link
              key={option}
              href={`/portal/book?${query.toString()}`}
              className={option === segment ? "segment-card chosen" : "segment-card"}
            >
              <strong>{info.label}</strong>
              <span className="muted small">{info.promise}</span>
              <ul>
                {info.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Link>
          )
        })}
      </div>

      {!searched ? (
        <p className="muted">Choose a date and time to see what is free.</p>
      ) : offers.length === 0 ? (
        <section className="portal-empty">
          <h2>Nothing free for that window</h2>
          <p>
            No {SEGMENT_INFO[segment].label.toLowerCase()} vehicle in {city} is both free and
            road-legal for those dates. Try another segment, or ask operators to quote — they can
            often move a vehicle for a longer trip.
          </p>
          <Link href="/portal/new" className="button-link">
            Get a quote instead
          </Link>
        </section>
      ) : (
        <>
          <h2 className="portal-section">
            {offers.length} vehicle{offers.length === 1 ? "" : "s"} free
          </h2>

          <div className="offer-list">
            {offers.map((offer) => (
              <article key={offer.vehicleId} className="offer-row">
                <div className="offer-vehicle">
                  <span className="segment-tag">{SEGMENT_INFO[offer.segment].label}</span>
                  <h3>{vehicleClassLabel(offer.vehicleClass as never)}</h3>
                  <p className="muted small numeric">{offer.registrationNumber}</p>
                  <p className="muted small">
                    {offer.seats} seats · {offer.yearOfManufacture}
                    {offer.features.length > 0
                      ? ` · ${offer.features.map(featureLabel).join(", ")}`
                      : ""}
                  </p>
                </div>

                <div className="offer-crew">
                  <p className="muted small">{offer.operatorName}</p>
                  {offer.driverName ? (
                    <p>
                      Driver <strong>{offer.driverName}</strong>
                      {offer.driverSpeaksRequested ? (
                        <span className="segment-tag speaks">
                          speaks {LANGUAGE_LABEL[params.driverLanguage as never] ?? ""}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="muted small">Driver assigned before departure</p>
                  )}
                </div>

                <div className="offer-price">
                  <p className="price-large">{formatPaise(offer.estimatedTotalPaise)}</p>
                  <p className="muted small">
                    up to {formatPaise(offer.worstCaseTotalPaise)} with extras
                  </p>
                  {offer.minimumKmShortfall > 0 ? (
                    <p className="muted small">
                      {offer.chargeableKm} km charged ({offer.terms.minKmPerDay} km/day minimum)
                    </p>
                  ) : null}

                  <form action={bookInstantAction}>
                    <input type="hidden" name="vehicleId" value={offer.vehicleId} />
                    <input type="hidden" name="operatorId" value={offer.operatorId} />
                    <input type="hidden" name="driverId" value={offer.driverId ?? ""} />
                    <input type="hidden" name="city" value={city} />
                    <input type="hidden" name="segment" value={segment} />
                    <input type="hidden" name="passengers" value={String(passengers)} />
                    <input type="hidden" name="km" value={String(estimatedKm)} />
                    <input
                      type="hidden"
                      name="driverLanguage"
                      value={params.driverLanguage ?? ""}
                    />
                    <input type="hidden" name="startAt" value={params.startAt ?? ""} />
                    <input type="hidden" name="endAt" value={params.endAt ?? ""} />
                    <button type="submit">Book this vehicle</button>
                  </form>
                </div>
              </article>
            ))}
          </div>

          <p className="footnote">
            {tollNotice(offers[0]?.terms.tollIncluded ?? false)} Departure{" "}
            {formatIst(fromIstInputValue(params.startAt as string))}.
          </p>
        </>
      )}
    </>
  )
}
