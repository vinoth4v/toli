import Link from "next/link"
import { ROLE_INFO, ROLES, type Role } from "@/domain/roles"
import { signInAction } from "./actions.ts"

/**
 * One door, four kinds of person behind it.
 *
 * §3 needs four users and this app has four applications, so the honest thing
 * to say on the way in is *which one you are about to enter*. `?as=` picks the
 * wording — nothing more. The role that decides where somebody actually lands
 * comes from their account, so a driver who follows the operator link still
 * ends up at `/drive`, and a curious visitor cannot escalate by editing a
 * query string. It is a signpost, not a gate, and it says so on the page.
 */

export const dynamic = "force-dynamic"

const ENTRY: Record<Role, { title: string; blurb: string; does: string[] }> = {
  customer: {
    title: "Book a vehicle for your group",
    blurb: "Your trips, the quotes operators sent, and the tracking link to share.",
    does: ["Ask for a vehicle", "Compare quotes side by side", "Watch the trip live"],
  },
  operator: {
    title: "Toli Partner",
    blurb: "Your quote inbox, your fleet's paperwork, and what every trip pays.",
    does: ["Answer requests fast", "Keep documents in date", "See every deduction"],
  },
  driver: {
    title: "Toli Driver",
    blurb: "Today's trip, and the three buttons that run it.",
    does: ["Start and finish trips", "Record tolls you paid", "SOS"],
  },
  admin: {
    title: "Toli ops",
    blurb: "Verification queue, matching desk, disputes, settlements.",
    does: ["Run the marketplace", "Verify documents", "Release payouts"],
  },
}

function isRole(value: string | undefined): value is Role {
  return value !== undefined && (ROLES as readonly string[]).includes(value)
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; as?: string }>
}) {
  const { error, as } = await searchParams
  const chosen = isRole(as) ? as : null
  const entry = chosen ? ENTRY[chosen] : null

  return (
    <main className="narrow signin-page">
      <Link href="/" className="wordmark">
        toli
        {chosen ? <small>{ROLE_INFO[chosen].label.toLowerCase()}</small> : null}
      </Link>

      <h1>{entry ? entry.title : "Sign in"}</h1>
      <p className="muted">
        {entry
          ? entry.blurb
          : "Toli is four applications behind one door — for groups booking a vehicle, for fleet operators, for drivers, and for Toli's own desk. Sign in and you land in yours."}
      </p>

      {error ? (
        // Never say which half was wrong.
        <p role="alert">That email and password combination was not accepted.</p>
      ) : null}

      {entry ? (
        <ul className="entry-does">
          {entry.does.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      <form action={signInAction}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit">Sign in</button>
      </form>

      <section className="who">
        <p className="who-label">{chosen ? "Not you?" : "Who is signing in?"}</p>
        <div className="who-grid">
          {ROLES.filter((role) => role !== chosen).map((role) => (
            <Link key={role} href={`/login?as=${role}`} className="who-card">
              <strong>{ROLE_INFO[role].label}</strong>
              <span>{ROLE_INFO[role].purpose}</span>
            </Link>
          ))}
        </div>
        <p className="muted small">
          Choosing here only changes what this page says. Where you land is decided by your account,
          so use whichever link you like — you will end up in the right place.
        </p>
      </section>

      <p className="muted small">
        Looking for a trip somebody is on? The tracking link you were sent needs no sign-in.{" "}
        <Link href="/">Back to Toli</Link>.
      </p>
    </main>
  )
}
