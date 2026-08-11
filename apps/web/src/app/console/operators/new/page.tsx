import Link from "next/link"
import { Card, PageHead } from "@/components/ui"
import { getSettings } from "@/data/settings"
import { LAUNCH_CITIES } from "@/domain/india"
import { formatBps } from "@/domain/money"
import { createOperatorAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function NewOperatorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, settings] = await Promise.all([searchParams, getSettings()])

  return (
    <>
      <PageHead
        title="Sign an operator"
        intro="The commercial terms and the KYC identity. Vehicles, drivers and documents go on afterwards, one at a time."
        actions={
          <Link href="/console/operators">
            <button type="button" className="quiet">
              Back
            </button>
          </Link>
        }
      />

      {error ? <p role="alert">{error}</p> : null}

      <form action={createOperatorAction}>
        <Card title="Business">
          <div className="row">
            <div>
              <label htmlFor="name">Trading name</label>
              <input id="name" name="name" required />
            </div>
            <div>
              <label htmlFor="city">City</label>
              <input id="city" name="city" list="cities" defaultValue="Madurai" required />
              <datalist id="cities">
                {LAUNCH_CITIES.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="contactName">Contact</label>
              <input id="contactName" name="contactName" required />
            </div>
            <div>
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" required />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" />
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="pan">
                Business PAN
                <span className="hint">Needed before any payout</span>
              </label>
              <input id="pan" name="pan" />
            </div>
            <div>
              <label htmlFor="gstin">
                GSTIN
                <span className="hint">
                  Blank is normal — many small operators are below the threshold and are covered
                  under s.23(2) when the platform pays under s.9(5)
                </span>
              </label>
              <input id="gstin" name="gstin" />
            </div>
            <div>
              <label htmlFor="commissionPercent">
                Commission %
                <span className="hint">
                  Blank uses the platform rate of {formatBps(settings.defaultCommissionBps)}
                </span>
              </label>
              <input id="commissionPercent" name="commissionPercent" placeholder="10" />
            </div>
          </div>

          <div>
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Who introduced them, what they run, what they promised"
            />
          </div>

          <div className="button-row">
            <button type="submit">Create operator</button>
          </div>
        </Card>
      </form>
    </>
  )
}
