import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { driverLogins } from "@/data/register"
import { listDrivers } from "@/data/supply"
import { formatIstDate } from "@/domain/format"
import { LOCALE_LABEL, LOCALES } from "@/i18n"
import { addDriverAction } from "../actions.ts"
import { IssueLogin } from "./issue-login.tsx"

/**
 * The operator's drivers, and the one thing only an operator can do for them:
 * issue their sign-in.
 *
 * Drivers never self-register — §3 is blunt about why a driver is not just
 * another account — so this page is the driver onboarding flow. Add the
 * person, then issue a sign-in whose password appears once on this screen and
 * nowhere else, ever. The §8.4 checks (police, medical, induction) stay with
 * Toli ops: an operator attests nothing about their own driver here.
 */

export const dynamic = "force-dynamic"

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const session = await auth()
  const operatorId = session?.user.operatorId
  if (!operatorId) redirect("/login")

  const { saved, error } = await searchParams
  const drivers = await listDrivers(operatorId)
  const logins = await driverLogins(drivers.map((row) => row.id))

  return (
    <>
      <h1>Team</h1>
      <p className="muted">
        Your drivers. Each one signs into the Toli driver app with credentials you issue here — they
        see the trip, the route and the SOS button, and no prices, ever.
      </p>

      {saved ? <p className="state good">{saved} added. Now issue their sign-in below.</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Phone</th>
            <th>Speaks</th>
            <th>Licence</th>
            <th>Sign-in</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.phone}</td>
              <td>
                {row.languages
                  .map((code) => LOCALE_LABEL[code as (typeof LOCALES)[number]] ?? code)
                  .join(", ")}
              </td>
              <td>
                {row.dlNumber ?? "—"}
                {row.dlExpiresOn ? (
                  <span className="muted small"> · to {formatIstDate(row.dlExpiresOn)}</span>
                ) : null}
              </td>
              <td>
                {logins.has(row.id) ? (
                  <code>{logins.get(row.id)}</code>
                ) : (
                  <IssueLogin driverId={row.id} />
                )}
              </td>
            </tr>
          ))}
          {drivers.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                No drivers yet — add your first below.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <section className="price-form">
        <h2>Add a driver</h2>
        <form action={addDriverAction}>
          <div className="row">
            <div>
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required />
            </div>
            <div>
              <label htmlFor="phone">Mobile</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" required />
            </div>
          </div>

          <fieldset>
            <legend>
              Languages they can hold a conversation in
              <span className="hint">
                Customers can ask for a driver who speaks theirs — ticking honestly is what makes
                that promise keepable.
              </span>
            </legend>
            <div className="checks">
              {LOCALES.map((code) => (
                <label key={code}>
                  <input
                    type="checkbox"
                    name="languages"
                    value={code}
                    defaultChecked={code === "ta"}
                  />
                  {LOCALE_LABEL[code]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="row">
            <div>
              <label htmlFor="dlNumber">Driving licence number</label>
              <input id="dlNumber" name="dlNumber" placeholder="TN58 20250001234" />
            </div>
            <div>
              <label htmlFor="dlExpiresOn">Licence valid to</label>
              <input id="dlExpiresOn" name="dlExpiresOn" type="date" />
            </div>
          </div>

          <p className="muted small">
            Police verification, medical and induction are recorded by Toli when the paperwork is
            sighted — a driver cannot take a wheel on this platform until all three are in date.
          </p>

          <button type="submit">Add driver</button>
        </form>
      </section>
    </>
  )
}
