import Link from "next/link"
import { ToliLogo } from "@/components/logo"
import { registerCustomerAction, registerOperatorAction } from "./actions.ts"

/**
 * Registration, shaped like sign-in: who are you, then the form.
 *
 * Three cards, but only two forms. A customer is served immediately; an
 * operator applies and lands in the partner app with nothing sellable until
 * Toli verifies; a driver has no form at all, because a driver's sign-in is
 * issued by their operator — self-registered drivers with no operator behind
 * them is exactly the unverified-stranger problem this marketplace exists to
 * remove.
 */

export const dynamic = "force-dynamic"

const ERROR_TEXT: Record<string, string> = {
  invalid: "Something in the form was not right. Check each field and try again.",
  phone_invalid: "That does not look like an Indian mobile number.",
  phone_taken:
    "This phone number is already with Toli. Sign in, or call us and we will link your trips to a new account.",
  email_taken: "That email already has a Toli account — sign in instead.",
}

function SharedFields() {
  return (
    <>
      <div>
        <label htmlFor="phone">Mobile number</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98430 12345"
          required
        />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label htmlFor="city">City</label>
        <input id="city" name="city" defaultValue="Madurai" required />
      </div>
      <div>
        <label htmlFor="password">
          Choose a password
          <span className="hint">At least 8 characters.</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
    </>
  )
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; error?: string }>
}) {
  const { as, error } = await searchParams
  const alert = error ? (ERROR_TEXT[error] ?? ERROR_TEXT.invalid) : null

  if (as === "customer") {
    return (
      <main className="narrow signin-page">
        <Link href="/" className="wordmark-link">
          <ToliLogo sub="new account" />
        </Link>
        <p className="crumb">
          <Link href="/register">← Not booking? Choose again</Link>
        </p>

        <h1>Create your account</h1>
        <p className="muted">
          Book a vehicle that is free right now, or send one requirement to every operator who
          actually has what you need.
        </p>

        {alert ? <p role="alert">{alert}</p> : null}

        <form action={registerCustomerAction}>
          <div>
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" autoComplete="name" required />
          </div>
          <SharedFields />
          <button type="submit">Create account</button>
        </form>

        <p className="muted small">
          Already have one? <Link href="/login?as=customer">Sign in</Link>.
        </p>
      </main>
    )
  }

  if (as === "operator") {
    return (
      <main className="narrow signin-page">
        <Link href="/" className="wordmark-link">
          <ToliLogo sub="partner application" />
        </Link>
        <p className="crumb">
          <Link href="/register">← Not an operator? Choose again</Link>
        </p>

        <h1>Put your fleet on Toli</h1>
        <p className="muted">
          You can sign in and load your vehicles today. Nothing is offered to customers until Toli
          has verified your documents — that check is what your listing is worth.
        </p>

        {alert ? <p role="alert">{alert}</p> : null}

        <form action={registerOperatorAction}>
          <div>
            <label htmlFor="businessName">Travels / business name</label>
            <input
              id="businessName"
              name="businessName"
              placeholder="Meenakshi Travels"
              autoComplete="organization"
              required
            />
          </div>
          <div>
            <label htmlFor="name">Contact person</label>
            <input id="name" name="name" autoComplete="name" required />
          </div>
          <SharedFields />
          <button type="submit">Apply as an operator</button>
        </form>

        <p className="muted small">
          Already a partner? <Link href="/login?as=operator">Sign in</Link>.
        </p>
      </main>
    )
  }

  return (
    <main className="narrow signin-page">
      <Link href="/" className="wordmark-link">
        <ToliLogo />
      </Link>

      <h1>New to Toli?</h1>
      <p className="muted">Pick what you are here to do, and we will ask only what that needs.</p>

      <div className="pick-grid">
        <Link href="/register?as=customer" className="pick-card">
          <strong>I am booking for a group</strong>
          <span>
            Family trip, temple circuit, office outing, wedding — a whole vehicle, driven.
          </span>
          <span className="pick-go">Create an account →</span>
        </Link>
        <Link href="/register?as=operator" className="pick-card">
          <strong>I run vehicles</strong>
          <span>
            Put your fleet in front of every group asking, quote in one tap, get paid on time.
          </span>
          <span className="pick-go">Apply as an operator →</span>
        </Link>
        <div className="pick-card pick-note">
          <strong>I drive</strong>
          <span>
            Drivers do not register here — your operator creates your sign-in from their partner app
            and hands you the password. Already have it?
          </span>
          <span className="pick-go">
            <Link href="/login?as=driver">Sign in as a driver →</Link>
          </span>
        </div>
      </div>

      <p className="muted small">
        Already have an account? <Link href="/login">Sign in</Link>.
      </p>
    </main>
  )
}
