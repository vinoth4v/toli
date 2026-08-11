import { Card, PageHead } from "@/components/ui"
import { getSettings } from "@/data/settings"
import { recentEvents } from "@/db/events"
import { formatIst } from "@/domain/format"
import { GST_TREATMENTS } from "@/domain/gst"
import { STATE_NAMES } from "@/domain/india"
import { updateSettingsAction } from "./actions"

/**
 * The numbers the plan says will change once a CA and transport counsel have
 * answered — commission, the two statutory deductions, and above all the GST
 * treatment of §8.3.
 *
 * They are settings rather than constants precisely because the answer is not
 * known yet. Whichever way the opinion goes, the invoicing engine already
 * handles it and this page is where it is switched.
 */

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const [settings, events] = await Promise.all([getSettings(), recentEvents(30)])

  return (
    <>
      <PageHead
        title="Settings"
        intro="Platform economics and tax treatment. Every number here is one the build plan says needs a professional opinion before it becomes a line of code — so it is configuration, not a constant."
      />

      <div className="split">
        <div>
          <Card title="Economics">
            <form action={updateSettingsAction}>
              <div className="row">
                <div>
                  <label htmlFor="defaultCommissionPercent">
                    Commission %
                    <span className="hint">
                      Start at 8–12%. Agents take 15–25%; undercutting them visibly is the supply
                      pitch
                    </span>
                  </label>
                  <input
                    id="defaultCommissionPercent"
                    name="defaultCommissionPercent"
                    type="number"
                    step="0.5"
                    defaultValue={settings.defaultCommissionBps / 100}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="advancePercent">
                    Advance %
                    <span className="hint">20–30% online, balance before departure or in cash</span>
                  </label>
                  <input
                    id="advancePercent"
                    name="advancePercent"
                    type="number"
                    step="5"
                    defaultValue={settings.advanceBps / 100}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="quoteValidityHours">
                    Quote validity (hours)
                    <span className="hint">Quotes expire — 24 to 48 hours</span>
                  </label>
                  <input
                    id="quoteValidityHours"
                    name="quoteValidityHours"
                    type="number"
                    defaultValue={settings.quoteValidityHours}
                    required
                  />
                </div>
              </div>

              <div className="row">
                <div>
                  <label htmlFor="tcsPercent">
                    TCS %<span className="hint">s.52 CGST, collected by the platform</span>
                  </label>
                  <input
                    id="tcsPercent"
                    name="tcsPercent"
                    type="number"
                    step="0.25"
                    defaultValue={settings.tcsBps / 100}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tdsPercent">
                    TDS %<span className="hint">s.194-O, on e-commerce participants</span>
                  </label>
                  <input
                    id="tdsPercent"
                    name="tdsPercent"
                    type="number"
                    step="0.25"
                    defaultValue={settings.tdsBps / 100}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="homeState">
                    Home state
                    <span className="hint">
                      Toli's own registration — decides CGST+SGST against IGST
                    </span>
                  </label>
                  <select id="homeState" name="homeState" defaultValue={settings.homeState}>
                    {STATE_NAMES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="defaultGstTreatment">
                  GST treatment
                  <span className="hint">
                    The unresolved question: is a charter "transportation of passengers" or "rental
                    of a motor vehicle with operator"? It changes the rate, the input tax credit
                    position and unit economics by seven points. Get a written opinion, then set it
                    here.
                  </span>
                </label>
                <select
                  id="defaultGstTreatment"
                  name="defaultGstTreatment"
                  defaultValue={settings.defaultGstTreatment}
                >
                  {Object.entries(GST_TREATMENTS).map(([treatmentKey, treatment]) => (
                    <option key={treatmentKey} value={treatmentKey}>
                      {treatment.label}
                    </option>
                  ))}
                </select>
              </div>

              <h3>How customers reach Toli</h3>
              <p className="muted small">
                Published on the front page, the tracking link and every trip. §10 masks the
                operator's number until a booking exists; it never masks ours.
              </p>
              <div className="row">
                <div>
                  <label htmlFor="supportPhone">Support phone</label>
                  <input
                    id="supportPhone"
                    name="supportPhone"
                    defaultValue={settings.supportPhone}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="supportWhatsapp">WhatsApp</label>
                  <input
                    id="supportWhatsapp"
                    name="supportWhatsapp"
                    defaultValue={settings.supportWhatsapp}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="supportEmail">Email</label>
                  <input
                    id="supportEmail"
                    name="supportEmail"
                    type="email"
                    defaultValue={settings.supportEmail}
                    required
                  />
                </div>
              </div>

              <div className="button-row">
                <button type="submit">Save settings</button>
              </div>
            </form>
          </Card>

          <Card title="What each treatment means">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Treatment</th>
                    <th>Rate</th>
                    <th>ITC</th>
                    <th>SAC</th>
                    <th>Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(GST_TREATMENTS).map(([treatmentKey, treatment]) => (
                    <tr key={treatmentKey}>
                      <td>{treatment.label}</td>
                      <td className="right">{treatment.rateBps / 100}%</td>
                      <td>{treatment.inputTaxCredit ? "yes" : "no"}</td>
                      <td className="numeric">{treatment.sacCode}</td>
                      <td className="muted small">{treatment.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Audit log">
            <p className="muted small">
              Every action that moves money or changes what a customer was promised, attributable to
              whoever did it. Regulators and auditors will ask.
            </p>
            <ul className="timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <strong>{event.kind.replace(/_/g, " ")}</strong>
                  {event.detail ? ` — ${event.detail}` : ""}
                  <time>
                    {formatIst(event.at)} · {event.actor ?? "system"}
                  </time>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
