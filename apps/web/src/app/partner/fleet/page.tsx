import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { operatorFleet } from "@/data/scoped"
import { DOCUMENT_LABELS, daysUntil, expiryBucket } from "@/domain/compliance"
import { formatIstDate } from "@/domain/format"
import { featureLabel, vehicleClassLabel } from "@/domain/vehicle"

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

export default async function PartnerFleet() {
  const session = await auth()
  const operatorId = session?.user.operatorId
  if (!operatorId) redirect("/login")

  const fleet = await operatorFleet(operatorId)
  const blocked = fleet.filter((vehicle) => !vehicle.compliance.fitForService)

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
            <dd>{fleet.length}</dd>
          </div>
          <div>
            <dt>Blocked</dt>
            <dd className={blocked.length > 0 ? "urgent" : ""}>{blocked.length}</dd>
          </div>
        </dl>
      </header>

      {fleet.length === 0 ? (
        <p className="muted">No vehicles on file yet. Toli ops adds them during onboarding.</p>
      ) : (
        <div className="fleet-rows">
          {fleet.map((vehicle) => (
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
            </article>
          ))}
        </div>
      )}
    </>
  )
}
