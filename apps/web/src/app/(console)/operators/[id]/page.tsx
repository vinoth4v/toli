import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge, Card, Chip, Empty, Facts, PageHead, StatusBadge } from "@/components/ui"
import { getSettings } from "@/data/settings"
import { getOperator } from "@/data/supply"
import { assessDriver, DOCUMENT_LABELS, expiryBucket } from "@/domain/compliance"
import { formatIstDate, maskPhone } from "@/domain/format"
import { formatBps } from "@/domain/money"
import {
  featureLabel,
  VEHICLE_CLASS_INFO,
  VEHICLE_FEATURES,
  vehicleClassLabel,
} from "@/domain/vehicle"
import {
  addDocumentAction,
  addDriverAction,
  addVehicleAction,
  setOperatorStatusAction,
  verifyDocumentAction,
} from "../actions"

export const dynamic = "force-dynamic"

const BUCKET_TONE = {
  expired: "stop",
  missing: "stop",
  critical: "warn",
  soon: "warn",
  watch: "warn",
  ok: "ok",
} as const

export default async function OperatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [detail, settings] = await Promise.all([getOperator(id), getSettings()])
  if (!detail) notFound()

  const { operator, vehicles, drivers } = detail

  return (
    <>
      <PageHead
        title={operator.name}
        intro={`${operator.city} · ${operator.contactName} · ${maskPhone(operator.phone)}`}
        actions={<StatusBadge status={operator.status} />}
      />

      <div className="split">
        <div>
          <Card title={`Fleet (${vehicles.length})`}>
            {vehicles.length === 0 ? (
              <Empty>No vehicles yet. Add the first one below.</Empty>
            ) : (
              vehicles.map((vehicle) => (
                <article key={vehicle.id} className="quote-card">
                  <header className="quote-head">
                    <div>
                      <h3>{vehicle.registrationNumber}</h3>
                      <span className="muted small">
                        {vehicleClassLabel(vehicle.vehicleClass)} · {vehicle.seats} seats ·{" "}
                        {vehicle.ac ? "AC" : "non-AC"} · {vehicle.yearOfManufacture}
                      </span>
                    </div>
                    <div>
                      <StatusBadge status={vehicle.status} />{" "}
                      {vehicle.compliance.fitForInterstate ? (
                        <Badge tone="ok">interstate ready</Badge>
                      ) : (
                        <Badge tone="warn">in-state only</Badge>
                      )}
                    </div>
                  </header>

                  {vehicle.features.length > 0 ? (
                    <div className="chips">
                      {vehicle.features.map((feature) => (
                        <Chip key={feature}>{featureLabel(feature)}</Chip>
                      ))}
                    </div>
                  ) : null}

                  {vehicle.compliance.problems.length > 0 ? (
                    <ul className="small">
                      {vehicle.compliance.problems.map((problem) => (
                        <li key={problem.message}>
                          <Badge tone={problem.severity === "blocking" ? "stop" : "warn"}>
                            {problem.severity}
                          </Badge>{" "}
                          {problem.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small">All documents on file and in date.</p>
                  )}

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>Number</th>
                          <th>Expires</th>
                          <th>Verification</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {vehicle.documents.map((document) => {
                          const bucket = expiryBucket(document.expiresOn, new Date())
                          return (
                            <tr key={document.id}>
                              <td>{DOCUMENT_LABELS[document.kind]}</td>
                              <td className="numeric">{document.number ?? "—"}</td>
                              <td>
                                <Badge tone={BUCKET_TONE[bucket]}>
                                  {formatIstDate(document.expiresOn)}
                                </Badge>
                              </td>
                              <td>
                                <StatusBadge status={document.verification} />
                              </td>
                              <td>
                                {document.verification === "pending" ? (
                                  <form action={verifyDocumentAction} className="inline-form">
                                    <input type="hidden" name="documentId" value={document.id} />
                                    <input type="hidden" name="vehicleId" value={vehicle.id} />
                                    <select name="source" defaultValue="vahan" aria-label="Source">
                                      <option value="vahan">VAHAN</option>
                                      <option value="sarathi">Sarathi</option>
                                      <option value="gstn">GSTN</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                    <button type="submit" name="decision" value="verified">
                                      Verify
                                    </button>
                                    <button
                                      type="submit"
                                      name="decision"
                                      value="rejected"
                                      className="danger"
                                    >
                                      Reject
                                    </button>
                                  </form>
                                ) : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <details>
                    <summary className="small muted">Add a document</summary>
                    <form action={addDocumentAction}>
                      <input type="hidden" name="vehicleId" value={vehicle.id} />
                      <input type="hidden" name="operatorId" value={operator.id} />
                      <div className="row">
                        <div>
                          <label htmlFor={`kind-${vehicle.id}`}>Kind</label>
                          <select id={`kind-${vehicle.id}`} name="kind" required>
                            {Object.entries(DOCUMENT_LABELS).map(([kind, label]) => (
                              <option key={kind} value={kind}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`number-${vehicle.id}`}>Number</label>
                          <input id={`number-${vehicle.id}`} name="number" />
                        </div>
                        <div>
                          <label htmlFor={`issued-${vehicle.id}`}>Issued</label>
                          <input id={`issued-${vehicle.id}`} name="issuedOn" type="date" />
                        </div>
                        <div>
                          <label htmlFor={`expires-${vehicle.id}`}>Expires</label>
                          <input
                            id={`expires-${vehicle.id}`}
                            name="expiresOn"
                            type="date"
                            required
                          />
                        </div>
                      </div>
                      <button type="submit">Add document</button>
                    </form>
                  </details>
                </article>
              ))
            )}

            <details>
              <summary className="small muted">Add a vehicle</summary>
              <form action={addVehicleAction}>
                <input type="hidden" name="operatorId" value={operator.id} />
                <div className="row">
                  <div>
                    <label htmlFor="registrationNumber">Registration</label>
                    <input
                      id="registrationNumber"
                      name="registrationNumber"
                      placeholder="RJ 14 PA 4521"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="vehicleClass">Class</label>
                    <select id="vehicleClass" name="vehicleClass" required>
                      {Object.values(VEHICLE_CLASS_INFO).map((info) => (
                        <option key={info.key} value={info.key}>
                          {info.label}
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
                  <div>
                    <label htmlFor="photoCount">
                      Real photos on file
                      <span className="hint">Six or more: exterior, interior, seats, boot</span>
                    </label>
                    <input
                      id="photoCount"
                      name="photoCount"
                      type="number"
                      min="0"
                      defaultValue="0"
                    />
                  </div>
                </div>
                <div className="checks">
                  <label htmlFor="ac">
                    <input id="ac" name="ac" type="checkbox" defaultChecked />
                    AC
                  </label>
                  {VEHICLE_FEATURES.map((feature) => (
                    <label key={feature.key} htmlFor={`vf-${feature.key}`}>
                      <input
                        id={`vf-${feature.key}`}
                        name="features"
                        type="checkbox"
                        value={feature.key}
                      />
                      {feature.label}
                    </label>
                  ))}
                </div>
                <button type="submit">Add vehicle</button>
              </form>
            </details>
          </Card>

          <Card title={`Drivers (${drivers.length})`}>
            {drivers.length === 0 ? (
              <Empty>No drivers yet.</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Licence</th>
                      <th>Clearances</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((driver) => {
                      const problems = assessDriver({
                        dlExpiresOn: driver.dlExpiresOn,
                        policeVerifiedOn: driver.policeVerifiedOn,
                        medicalCheckedOn: driver.medicalCheckedOn,
                        inductionTrainedOn: driver.inductionTrainedOn,
                        asOf: new Date(),
                      })

                      return (
                        <tr key={driver.id}>
                          <td>
                            {driver.name}
                            <div className="muted small">{maskPhone(driver.phone)}</div>
                          </td>
                          <td>
                            <span className="numeric">{driver.dlNumber ?? "—"}</span>
                            <div className="muted small">
                              expires {formatIstDate(driver.dlExpiresOn)}
                            </div>
                          </td>
                          <td>
                            {problems.length === 0 ? (
                              <Badge tone="ok">cleared</Badge>
                            ) : (
                              <ul className="small">
                                {problems.map((problem) => (
                                  <li key={problem.message}>{problem.message}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <details>
              <summary className="small muted">Add a driver</summary>
              <form action={addDriverAction}>
                <input type="hidden" name="operatorId" value={operator.id} />
                <div className="row">
                  <div>
                    <label htmlFor="driverName">Name</label>
                    <input id="driverName" name="name" required />
                  </div>
                  <div>
                    <label htmlFor="driverPhone">Phone</label>
                    <input id="driverPhone" name="phone" required />
                  </div>
                  <div>
                    <label htmlFor="dlNumber">Licence number</label>
                    <input id="dlNumber" name="dlNumber" />
                  </div>
                  <div>
                    <label htmlFor="dlExpiresOn">Licence expires</label>
                    <input id="dlExpiresOn" name="dlExpiresOn" type="date" />
                  </div>
                </div>
                <div className="row">
                  <div>
                    <label htmlFor="policeVerifiedOn">
                      Police verification
                      <span className="hint">Required before onboarding under MVAG 2025</span>
                    </label>
                    <input id="policeVerifiedOn" name="policeVerifiedOn" type="date" />
                  </div>
                  <div>
                    <label htmlFor="medicalCheckedOn">Medical test</label>
                    <input id="medicalCheckedOn" name="medicalCheckedOn" type="date" />
                  </div>
                  <div>
                    <label htmlFor="inductionTrainedOn">Induction training</label>
                    <input id="inductionTrainedOn" name="inductionTrainedOn" type="date" />
                  </div>
                </div>
                <button type="submit">Add driver</button>
              </form>
            </details>
          </Card>
        </div>

        <div>
          <Card title="Commercials">
            <Facts
              items={[
                [
                  "Commission",
                  operator.commissionBps === null
                    ? `${formatBps(settings.defaultCommissionBps)} (platform default)`
                    : formatBps(operator.commissionBps),
                ],
                ["Tier", operator.tier],
                ["PAN", operator.pan ?? "—"],
                ["GSTIN", operator.gstin ?? "unregistered"],
                ["Bank", operator.bankAccountLast4 ? `••••${operator.bankAccountLast4}` : "—"],
              ]}
            />

            <form action={setOperatorStatusAction} className="inline-form">
              <input type="hidden" name="operatorId" value={operator.id} />
              <div>
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={operator.status}>
                  <option value="draft">Draft</option>
                  <option value="pending_verification">Pending verification</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label htmlFor="tier">
                  Tier
                  <span className="hint">Gold settles immediately</span>
                </label>
                <select id="tier" name="tier" defaultValue={operator.tier}>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>
              </div>
              <button type="submit">Save</button>
            </form>
          </Card>

          {operator.notes ? (
            <Card title="Notes">
              <p className="small">{operator.notes}</p>
            </Card>
          ) : null}

          <Card title="Where this operator appears">
            <p className="muted small">
              A vehicle is offered to a trip only when its documents are in date and, for an
              interstate trip, its All India Tourist Permit is valid and the vehicle is inside the
              age limit. That rule is enforced at assignment, not merely displayed here.
            </p>
            <Link href="/fleet">
              <button type="button" className="quiet">
                See the whole fleet
              </button>
            </Link>
          </Card>
        </div>
      </div>
    </>
  )
}
