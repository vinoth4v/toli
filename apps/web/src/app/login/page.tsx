import Link from "next/link"
import { signInAction } from "./actions.ts"

/**
 * The gate, dressed to match the front door.
 *
 * It is no longer what a visitor to the production URL sees — `/` is the
 * marketplace now — so this page can be what it actually is: a small, quiet
 * door for the one person who runs the place.
 */

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="narrow signin-page">
      <Link href="/" className="wordmark">
        toli
        <small>ops console</small>
      </Link>

      <h1>Sign in</h1>
      <p className="muted">
        The operator's console — RFQs, quotes, compliance and settlements. One account, by design.
      </p>

      {error ? (
        // Never say which half was wrong.
        <p role="alert">That email and password combination was not accepted.</p>
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

      <p className="muted small">
        Looking for your trip? The tracking link you were sent needs no sign-in.{" "}
        <Link href="/">Back to Toli</Link>.
      </p>
    </main>
  )
}
