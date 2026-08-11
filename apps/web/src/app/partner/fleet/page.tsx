import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { photosFor } from "@/data/fleet"
import { operatorFleet } from "@/data/scoped"
import { DOCUMENT_LABELS, daysUntil, expiryBucket } from "@/domain/compliance"
import { formatIstDate } from "@/domain/format"
import { SEGMENT_INFO } from "@/domain/segment"
import {
  featureLabel,
  VEHICLE_CLASS_INFO,
  VEHICLE_FEATURES,
  vehicleClassLabel,
} from "@/domain/vehicle"
import { isStorageConfigured } from "@/integrations/storage"
import {
  addDocumentAction,
  addVehicleAction,
  linkPhotoAction,
  removePhotoAction,
  retireVehicleAction,
} from "../actions"
import { UploadPhoto } from "../upload-photo"

/**
 * The operator's own fleet, judged by the same rules Toli judges it by.
 *
 * Showing an operator exactly why a vehicle is blocked — and how many days are
 * left on each document — is what turns a suspension from an argument into a
 * task. §4.2's reminder ladder is only useful if the person who can act on it
 * can see it.
 */

export const dynamic = "force-dynamic"

const TONE = {
  expired: "bad",
  missing: "bad",
  critical: "warn",
  soon: "warn",
  watch: "warn",
  ok: "good",
} as const

export default async function PartnerFleet({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const [{ error, saved }, session] = await Promise.all([searchParams, auth()])
  const operatorId = session?.user.operatorId
  if (!operatorId) redirect("/login")

  const fleet = await operatorFleet(operatorId)
  const live = fleet.filter((vehicle) => vehicle.status !== "retired")
  const blocked = live.filter((vehicle) => !vehicle.compliance.fitForService)
  const photos = await photosFor(live.map((vehicle) => vehicle.id))
  const storageReady = isStorageConfigured()

  return (
    <>
      <header className="partner-head">
        <div>
          <h1>Fleet</h1>
          <p className="muted small">
            A vehicle whose papers have lapsed cannot be assigned to a trip — not by you, not by
            Toli. Renew before the date and nothing stops.
          </p>
        </div>
        <dl className="partner-stats">
          <div>
            <dt>Vehicles</dt>
            <dd>{live.length}</dd>
          </div>
          <div>
            <dt>Blocked</dt>
            <dd className={blocked.length > 0 ? "urgent" : ""}>{blocked.length}</dd>
          </div>
        </dl>
      </header>

      {error ? <p role="alert">{error}</p> : null}
      {saved ? (
        <p className="notice">
          {saved} added. Toli checks its papers before it can be booked — add them below to speed
          that up.
        </p>
      ) : null}

      {live.length === 0 ? (
        <p className="muted">No vehicles yet. Add your first one below.</p>
      ) : (
        <div className="fleet-rows">
          {live.map((vehicle) => (
            <article
              key={vehicle.id}
              className={vehicle.compliance.fitForService ? "fleet-row" : "fleet-row blocked"}
            >
              <header>
                <div>
                  <h3 className="numeric">{vehicle.registrationNumber}</h3>
                  <p className="muted small">
                    {vehicleClassLabel(vehicle.vehicleClass)} · {vehicle.seats} seats ·{" "}
                    {vehicle.ac ? "AC" : "non-AC"} · {vehicle.yearOfManufacture}
                  </p>
                </div>
                <span className={`state ${vehicle.compliance.fitForService ? "good" : "bad"}`}>
                  {vehicle.compliance.fitForService
                    ? vehicle.compliance.fitForInterstate
                      ? "Ready, interstate"
                      : "Ready, in-state only"
                    : "Cannot be booked"}
                </span>
              </header>

              {vehicle.features.length > 0 ? (
                <ul className="chip-list">
                  {vehicle.features.map((feature) => (
                    <li key={feature} className="chip info">
                      {featureLabel(feature)}
                    </li>
                  ))}
                </ul>
              ) : null}

              <table className="doc-table">
                <tbody>
                  {vehicle.documents.map((document) => {
                    const bucket = expiryBucket(document.expiresOn, new Date())
                    const days = document.expiresOn
                      ? daysUntil(document.expiresOn, new Date())
                      : null
                    return (
                      <tr key={document.id}>
                        <td>{DOCUMENT_LABELS[document.kind]}</td>
                        <td className="numeric">{formatIstDate(document.expiresOn)}</td>
                        <td>
                          <span className={`state ${TONE[bucket]}`}>
                            {bucket === "expired"
                              ? "expired"
                              : days === null
                                ? "no date"
                                : `${days} days left`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {vehicle.compliance.problems.length > 0 ? (
                <ul className="problem-list">
                  {vehicle.compliance.problems.map((problem) => (
                    <li key={problem.message} className={problem.severity}>
                      {problem.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              {(() => {
                const own = photos.filter((photo) => photo.vehicleId === vehicle.id)
                return (
                  <>
                    {own.length > 0 ? (
                      <div className="photo-strip">
                        {own.map((photo) => (
                          <figure key={photo.id}>
                            {/* Operator-supplied URLs, so next/image would need
                                a remote-pattern allowlist per bucket; a plain
                                img is the honest thing until there is one. */}
                            {/* biome-ignore lint/performance/noImgElement: see above */}
                            <img
                              src={photo.url}
                              alt={`${vehicle.registrationNumber} ${photo.kind}`}
                            />
                            <figcaption>
                              <span className="muted small">{photo.kind}</span>
                              <form action={removePhotoAction}>
                                <input type="hidden" name="photoId" value={photo.id} />
                                <button type="submit" className="quiet">
                                  Remove
                                </button>
                              </form>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p className="muted small">
                        No photos yet. Customers compare vehicles on these, and §4.1's rule is real
                        ones — a stock image of a different bus is how a trip goes wrong.
                      </p>
                    )}

                    <details>
                      <summary className="small muted">Add a photo</summary>
                      {storageReady ? (
                        <UploadPhoto
                          vehicleId={vehicle.id}
                          registration={vehicle.registrationNumber}
                        />
                      ) : (
                        <p className="muted small">
                          Direct upload is not configured yet, so link a photo you host elsewhere.
                        </p>
                      )}

                      <form action={linkPhotoAction} className="inline-form">
                        <input type="hidden" name="vehicleId" value={vehicle.id} />
                        <div>
                          <label htmlFor={`purl-${vehicle.id}`}>Photo link</label>
                          <input
                            id={`purl-${vehicle.id}`}
                            name="url"
                            placeholder="https://…"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor={`pkind-${vehicle.id}`}>Shows</label>
                          <select id={`pkind-${vehicle.id}`} name="kind" defaultValue="exterior">
                            <option value="exterior">Outside</option>
                            <option value="interior">Inside</option>
                            <option value="seats">Seats</option>
                            <option value="boot">Luggage space</option>
                          </select>
                        </div>
                        <button type="submit" className="quiet">
                          Link photo
                        </button>
                      </form>
                    </details>

                    <details>
                      <summary className="small muted">Add a document</summary>
                      <form action={addDocumentAction} className="inline-form">
                        <input type="hidden" name="vehicleId" value={vehicle.id} />
                        <div>
                          <label htmlFor={`dkind-${vehicle.id}`}>Document</label>
                          <select id={`dkind-${vehicle.id}`} name="kind" required>
                            {Object.entries(DOCUMENT_LABELS).map(([kind, label]) => (
                              <option key={kind} value={kind}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`dnum-${vehicle.id}`}>Number</label>
                          <input id={`dnum-${vehicle.id}`} name="number" />
                        </div>
                        <div>
                          <label htmlFor={`dexp-${vehicle.id}`}>Expires</label>
                          <input id={`dexp-${vehicle.id}`} name="expiresOn" type="date" required />
                        </div>
                        <button type="submit" className="quiet">
                          Add
                        </button>
                      </form>
                      <p className="muted small">
                        Toli verifies it before the vehicle can be booked. You cannot mark your own
                        paperwork as checked — that is what the badge is worth.
                      </p>
                    </details>

                    <form action={retireVehicleAction} className="retire">
                      <input type="hidden" name="vehicleId" value={vehicle.id} />
                      <button type="submit" className="danger">
                        Remove this vehicle
                      </button>
                      <span className="muted small">
                        Retires it. Past trips, invoices and settlements still refer to it.
                      </span>
                    </form>
                  </>
                )
              })()}
            </article>
          ))}
        </div>
      )}

      <section className="price-form">
        <h2>Add a vehicle</h2>
        <p className="muted small">
          It arrives as pending until Toli has checked its papers. Segment is worked out from what
          the vehicle actually has — air conditioning and push-back seats — rather than from what it
          is called.
        </p>
        <form action={addVehicleAction}>
          <div className="row">
            <div>
              <label htmlFor="registrationNumber">Registration</label>
              <input
                id="registrationNumber"
                name="registrationNumber"
                placeholder="TN 58 AL 4521"
                required
              />
            </div>
            <div>
              <label htmlFor="vehicleClass">Type</label>
              <select id="vehicleClass" name="vehicleClass" required>
                {Object.values(VEHICLE_CLASS_INFO).map((info) => (
                  <option key={info.key} value={info.key}>
                    {info.label} ({info.seatOptions.join("/")})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seats">Seats</label>
              <input id="seats" name="seats" type="number" min="4" required />
            </div>
            <div>
              <label htmlFor="yearOfManufacture">Year</label>
              <input
                id="yearOfManufacture"
                name="yearOfManufacture"
                type="number"
                min="1990"
                required
              />
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="fuelType">Fuel</label>
              <select id="fuelType" name="fuelType" defaultValue="diesel">
                <option value="diesel">Diesel</option>
                <option value="cng">CNG</option>
                <option value="electric">Electric</option>
                <option value="petrol">Petrol</option>
              </select>
            </div>
          </div>

          <div className="checks">
            <label htmlFor="ac">
              <input id="ac" name="ac" type="checkbox" defaultChecked />
              Air conditioned
            </label>
            {VEHICLE_FEATURES.map((feature) => (
              <label key={feature.key} htmlFor={`nf-${feature.key}`}>
                <input
                  id={`nf-${feature.key}`}
                  name="features"
                  type="checkbox"
                  value={feature.key}
                />
                {feature.label}
              </label>
            ))}
          </div>

          <p className="muted small">
            Air conditioning makes it {SEGMENT_INFO.premium.label}; add push-back seats and it is{" "}
            {SEGMENT_INFO.luxury.label}. Without AC it is {SEGMENT_INFO.economy.label}.
          </p>

          <button type="submit">Add vehicle</button>
        </form>
      </section>
    </>
  )
}
