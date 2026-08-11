import Link from "next/link"
import { ROLE_INFO, ROLES, type Role } from "@/domain/roles"
import { signInAction } from "./actions.ts"

/**
 * Two steps: who are you, then prove it.
 *
 * The first version put the form first and the four doors underneath, which
 * asked people to type a password before they knew which application they were
 * entering — and left three of the four wondering whether they were in the
 * right place at all. Choosing first is how every multi-tenant product that
 * works does it, and it costs one tap.
 *
 * `?as=` still only changes wording. The role that decides where somebody
 * lands comes from their account, so a driver who picks the operator card
 * still ends up at `/drive` and nobody escalates by editing a query string.
 * It is a signpost, not a gate, and the page says so where it matters.
 */

export const dynamic = "force-dynamic"

const ENTRY: Record<Role, { title: string; blurb: string; does: string[] }> = {
  customer: {
    title: "Book a vehicle for your group",
    blurb: "Your trips, the quotes operators sent, and the tracking link to share.",
    does: ["Book a vehicle that is free now", "Compare quotes side by side", "Watch the trip live"],
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

/** The order people actually arrive in: most are booking, almost nobody is staff. */
const ORDER: Role[] = ["customer", "operator", "driver", "admin"]

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

  // Step one — nobody has said who they are yet, so there is no form to show.
  if (!chosen) {
    return (
      <main className="narrow signin-page">
        <Link href="/" className="wordmark">
          toli
        </Link>

        <h1>Who is signing in?</h1>
        <p className="muted">
          Toli is four applications behind one door. Pick yours and we will take you to the right
          one.
        </p>

        {error ? <p role="alert">That email and password combination was not accepted.</p> : null}

        <div className="pick-grid">
          {ORDER.map((role) => (
            <Link key={role} href={`/login?as=${role}`} className="pick-card">
              <strong>{ROLE_INFO[role].label}</strong>
              <span>{ROLE_INFO[role].purpose}</span>
              <span className="pick-go">Continue →</span>
            </Link>
          ))}
        </div>

        <p className="muted small">
          Looking for a trip somebody is on? The tracking link you were sent needs no sign-in.{" "}
          <Link href="/">Back to Toli</Link>.
        </p>
      </main>
    )
  }

  // Step two — they have said who they are, so ask for the credentials.
  const entry = ENTRY[chosen]

  return (
    <main className="narrow signin-page">
      <Link href="/" className="wordmark">
        toli
        <small>{ROLE_INFO[chosen].label.toLowerCase()}</small>
      </Link>

      <p className="crumb">
        <Link href="/login">← Not you? Choose again</Link>
      </p>

      <h1>{entry.title}</h1>
      <p className="muted">{entry.blurb}</p>

      {error ? (
        // Never say which half was wrong.
        <p role="alert">That email and password combination was not accepted.</p>
      ) : null}

      <ul className="entry-does">
        {entry.does.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <form action={signInAction}>
        {/* Carried so a failed attempt returns to this step, not the chooser. */}
        <input type="hidden" name="as" value={chosen} />
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

      <p className="muted small">
        Your account decides where you land, so if you picked the wrong card here you will still end
        up in the right place.
      </p>
    </main>
  )
}
