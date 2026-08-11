import Link from "next/link"
import { Badge, Card, Empty, PageHead, StatusBadge } from "@/components/ui"
import {
  complianceQueue,
  driversWithExpiringLicence,
  vehiclesNeedingSuspension,
} from "@/data/supply"
import { DOCUMENT_LABELS, daysUntil } from "@/domain/compliance"
import { formatIstDate } from "@/domain/format"
import { isConfigured } from "@/integrations/config"
import { SOURCE_FOR_DOCUMENT } from "@/integrations/verification"
import { verifyVehicleAction } from "../integrations/actions"
import { verifyDocumentAction } from "../operators/actions"

/**
 * The verification queue of §4.4 and the expiry ladder of §4.2, in one place.
 *
 * Ordered by consequence: what has already expired, then what expires within
 * a week, then the 15- and 30-day reminders. Documents nobody has verified sit
 * here too — an unverified insurance certificate is a photograph, not a fact.
 */

export const dynamic = "force-dynamic"

const BUCKET_TONE = {
  expired: "stop",
  missing: "stop",
  critical: "warn",
  soon: "warn",
  watch: "warn",
  ok: "ok",
} as const

export default async function CompliancePage() {
  const now = new Date()
  const verificationLive = isConfigured("verification")
  const [queue, needingSuspension, expiringLicences] = await Promise.all([
    complianceQueue(now),
    vehiclesNeedingSuspension(now),
    driversWithExpiringLicence(new Date(now.getTime() + 30 * 86_400_000)),
  ])

  return (
    <>
      <PageHead
        title="Compliance"
        intro="Expiry tracking with 30/15/7-day reminders, and hard suspension for a vehicle whose permit or insurance has lapsed. Non-negotiable — a coach detained at a border post at 2 AM is the alternative."
      />

      {needingSuspension.length > 0 ? (
        <Card title={`Suspend now (${needingSuspension.length})`}>
          <p className="notice">
            These vehicles are still marked active but no longer pass. They are already refused at
            assignment; suspend them so the operator sees why.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Operator</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {needingSuspension.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="numeric">{vehicle.registrationNumber}</td>
                    <td>
                      <Link href={`/console/operators/${vehicle.operatorId}`}>
                        {vehicle.operatorName}
                      </Link>
                    </td>
                    <td>{vehicle.compliance.suspensionReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/console/fleet">
            <button type="button">Go to the fleet screen to suspend</button>
          </Link>
        </Card>
      ) : null}

      <Card title={`Document queue (${queue.length})`}>
        {queue.length === 0 ? (
          <Empty>Nothing expiring within 30 days, and nothing awaiting verification.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Operator</th>
                  <th>Document</th>
                  <th>Expires</th>
                  <th>Verification</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.document.id}>
                    <td className="numeric">
                      {item.registrationNumber}
                      <div className="muted small">
                        <StatusBadge status={item.vehicleStatus} />
                      </div>
                    </td>
                    <td>
                      <Link href={`/console/operators/${item.operatorId}`}>
                        {item.operatorName}
                      </Link>
                    </td>
                    <td>{DOCUMENT_LABELS[item.document.kind]}</td>
                    <td>
                      <Badge tone={BUCKET_TONE[item.bucket]}>
                        {item.document.expiresOn
                          ? `${formatIstDate(item.document.expiresOn)} · ${daysUntil(
                              item.document.expiresOn,
                              new Date(),
                            )} days`
                          : "no expiry recorded"}
                      </Badge>
                    </td>
                    <td>
                      <StatusBadge status={item.document.verification} />
                    </td>
                    <td>
                      {item.document.verification === "pending" ? (
                        <>
                          {verificationLive &&
                          SOURCE_FOR_DOCUMENT[item.document.kind] === "vahan" ? (
                            <form action={verifyVehicleAction}>
                              <input type="hidden" name="vehicleId" value={item.vehicleId} />
                              <input type="hidden" name="documentId" value={item.document.id} />
                              <input type="hidden" name="operatorId" value={item.operatorId} />
                              <input
                                type="hidden"
                                name="registrationNumber"
                                value={item.registrationNumber}
                              />
                              <button type="submit">Check VAHAN</button>
                            </form>
                          ) : null}
                          <form action={verifyDocumentAction} className="inline-form">
                            <input type="hidden" name="documentId" value={item.document.id} />
                            <input type="hidden" name="vehicleId" value={item.vehicleId} />
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
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Driver licences expiring (${expiringLicences.length})`}>
        {expiringLicences.length === 0 ? (
          <Empty>No licence expires within 30 days.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Operator</th>
                  <th>Licence expires</th>
                </tr>
              </thead>
              <tbody>
                {expiringLicences.map((row) => (
                  <tr key={row.driver.id}>
                    <td>{row.driver.name}</td>
                    <td>{row.operatorName}</td>
                    <td>{formatIstDate(row.driver.dlExpiresOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="What automatic verification will replace">
        <p className="muted small">
          Today an ops person reads VAHAN, Sarathi or the GSTIN portal and records what it said —
          into the same table an automated check will write to. Access goes through an authorised
          aggregator and is a Month-2 item in the plan; when it lands, what changes is who calls the
          recording function, not what is stored or how a vehicle is judged.
        </p>
      </Card>
    </>
  )
}
