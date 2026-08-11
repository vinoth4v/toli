"use client"

import { useState } from "react"
import { issueDriverLoginAction } from "../actions.ts"

/**
 * The one screen where a password is ever visible.
 *
 * A client component because the password must be shown exactly once, to the
 * operator, on this screen — never sent through a URL where it would sit in
 * history and access logs, and never stored anywhere but as a hash. Closing
 * the page loses it; issuing again is Toli ops resetting it.
 */
export function IssueLogin({ driverId }: { driverId: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "busy" }
    | { kind: "issued"; email: string; password: string }
    | { kind: "failed"; message: string }
  >({ kind: "idle" })

  if (state.kind === "issued") {
    return (
      <div className="issued">
        <p>
          <strong>Shown once — hand it to the driver now.</strong> Toli does not keep a copy.
        </p>
        <p>
          Sign-in: <code>{state.email}</code>
          <br />
          Password: <code>{state.password}</code>
        </p>
        <p className="muted small">
          The sign-in is an identifier made from their phone number, not a mailbox — nothing is ever
          emailed to it. They sign in at toli.in as a driver.
        </p>
      </div>
    )
  }

  if (state.kind === "failed") {
    return <p role="alert">{state.message}</p>
  }

  return (
    <button
      type="button"
      className="quiet"
      disabled={state.kind === "busy"}
      onClick={async () => {
        setState({ kind: "busy" })
        const result = await issueDriverLoginAction(driverId)
        setState(
          result.ok
            ? { kind: "issued", email: result.email, password: result.password }
            : { kind: "failed", message: result.message },
        )
      }}
    >
      {state.kind === "busy" ? "Issuing…" : "Issue sign-in"}
    </button>
  )
}
