import { Badge, Card, Empty, PageHead, StatusBadge } from "@/components/ui"
import { listDevices } from "@/data/ingest"
import { pendingNotifications } from "@/data/notifications"
import { listVehicles } from "@/data/supply"
import { formatIst, maskPhone } from "@/domain/format"
import { integrationStatuses } from "@/integrations/config"
import { enrolDeviceAction, markSentByHandAction, revokeDeviceAction } from "./actions"

/**
 * What Toli is wired to, and what it is not.
 *
 * This screen exists because the honest answer today is "mostly not", and an
 * app that hides that is worse than one that admits it: an ops person needs to
 * know whether the payment link button will do anything before they promise a
 * customer a link. Every integration shows which variables are set, what turns
 * on when they are, and what happens meanwhile — because in every case there
 * is a slower manual path that still works.
 */

export const dynamic = "force-dynamic"

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const [{ token, error }, statuses, devices, outbox, vehicles] = await Promise.all([
    searchParams,
    Promise.resolve(integrationStatuses()),
    listDevices(),
    pendingNotifications(25),
    listVehicles(),
  ])

  const live = statuses.filter((status) => status.configured).length

  return (
    <>
      <PageHead
        title="Integrations"
        intro={`${live} of ${statuses.length} external systems are wired up. Everything not wired up has a manual path that still works — nothing here silently pretends.`}
      />

      {error ? <p role="alert">{error}</p> : null}

      {token ? (
        <Card title="Device token — shown once">
          <p className="notice">
            Copy this now. Only its SHA-256 is stored, so it cannot be shown again; if it is lost,
            revoke the device and enrol another.
          </p>
          <p className="numeric">{token}</p>
          <p className="muted small">
            The driver app sends it as <code>Authorization: Bearer …</code> to{" "}
            <code>/api/ingest/ping</code>; a telematics vendor posts to{" "}
            <code>/api/ingest/vltd</code>.
          </p>
        </Card>
      ) : null}

      <div className="grid">
        {statuses.map((status) => (
          <section key={status.key} className="card">
            <h2>
              {status.label}{" "}
              {status.configured ? (
                <Badge tone="ok">live</Badge>
              ) : (
                <Badge tone="warn">not configured</Badge>
              )}
            </h2>
            <p className="small">{status.configured ? status.enables : status.whileOff}</p>

            <table>
              <tbody>
                {status.variables.map((variable) => (
                  <tr key={variable.name}>
                    <td className="numeric small">{variable.name}</td>
                    <td>
                      {variable.present ? (
                        <Badge tone="ok">set</Badge>
                      ) : variable.required ? (
                        <Badge tone="stop">missing</Badge>
                      ) : (
                        <Badge>optional</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="muted small">{status.source}</p>
          </section>
        ))}
      </div>

      <Card title="Tracking devices">
        <p className="muted small">
          Position ingest is the one integration that needs no third party. A driver's phone or an
          AIS-140 VLTD box authenticates with its own token and can write a position and nothing
          else. Ingesting the telematics feed matters because it keeps tracking alive when the
          driver's phone dies — which it will.
        </p>

        {devices.length === 0 ? (
          <Empty>No devices enrolled.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Kind</th>
                  <th>Vehicle</th>
                  <th>Token</th>
                  <th>Last seen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {devices.map((row) => (
                  <tr key={row.device.id}>
                    <td>
                      {row.device.label}
                      {row.device.vendor ? (
                        <div className="muted small">{row.device.vendor}</div>
                      ) : null}
                    </td>
                    <td>{row.device.kind.replace(/_/g, " ")}</td>
                    <td className="numeric">{row.registration ?? "—"}</td>
                    <td className="numeric">…{row.device.tokenLastFour}</td>
                    <td>{formatIst(row.device.lastSeenAt)}</td>
                    <td>
                      {row.device.active ? (
                        <form action={revokeDeviceAction}>
                          <input type="hidden" name="deviceId" value={row.device.id} />
                          <button type="submit" className="danger">
                            Revoke
                          </button>
                        </form>
                      ) : (
                        <Badge tone="stop">revoked</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details>
          <summary className="small muted">Enrol a device</summary>
          <form action={enrolDeviceAction}>
            <div className="row">
              <div>
                <label htmlFor="label">Label</label>
                <input id="label" name="label" placeholder="Ramesh's phone" required />
              </div>
              <div>
                <label htmlFor="kind">Kind</label>
                <select id="kind" name="kind" defaultValue="driver_app">
                  <option value="driver_app">Driver app</option>
                  <option value="vltd">AIS-140 VLTD box</option>
                </select>
              </div>
              <div>
                <label htmlFor="vehicleId">
                  Vehicle
                  <span className="hint">A VLTD box is bolted to one vehicle</span>
                </label>
                <select id="vehicleId" name="vehicleId" defaultValue="">
                  <option value="">—</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registrationNumber} · {vehicle.operatorName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="vendor">Telematics vendor</label>
                <input id="vendor" name="vendor" placeholder="for a VLTD box" />
              </div>
            </div>
            <button type="submit">Enrol and show token</button>
          </form>
        </details>
      </Card>

      <Card title="Outbox">
        <p className="muted small">
          Every message is a row before it is an API call, including while WhatsApp is unconfigured
          — so the ops desk can see exactly what should go to whom and send it by hand. When
          credentials arrive the same queue drains automatically.
        </p>

        {outbox.length === 0 ? (
          <Empty>Nothing queued.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>To</th>
                  <th>Content</th>
                  <th>Status</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {outbox.map((message) => (
                  <tr key={message.id}>
                    <td>{message.template}</td>
                    <td className="numeric">{maskPhone(message.toPhone)}</td>
                    <td className="small">
                      {(JSON.parse(message.payload) as string[]).join(" · ")}
                    </td>
                    <td>
                      <StatusBadge status={message.status} />
                      {message.error ? (
                        <div className="muted small">{message.error.slice(0, 120)}</div>
                      ) : null}
                    </td>
                    <td>{formatIst(message.createdAt)}</td>
                    <td>
                      {message.status === "queued" || message.status === "failed" ? (
                        <form action={markSentByHandAction}>
                          <input type="hidden" name="notificationId" value={message.id} />
                          <button type="submit" className="quiet">
                            Sent by hand
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
