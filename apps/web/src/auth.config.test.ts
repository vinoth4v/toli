import { describe, expect, it } from "vitest"
import { authConfig } from "./auth.config.ts"

/**
 * The session callback is the only place the JWT's claims become the session
 * every page and action reads. It went to production once without mapping
 * `token.sub` to `session.user.id` — nothing noticed for weeks because every
 * flow read role or a link id, until avatar upload became the first feature
 * to need the id itself and bounced valid sessions to /login.
 */
describe("session callback", () => {
  const make = (token: Record<string, unknown>) =>
    // biome-ignore lint/suspicious/noExplicitAny: exercising the callback with the shapes next-auth passes at runtime
    (authConfig.callbacks.session as any)({ session: { user: {} }, token })

  it("maps token.sub to session.user.id", () => {
    const session = make({ sub: "user-123", role: "customer" })
    expect(session.user.id).toBe("user-123")
  })

  it("carries the role and every link id", () => {
    const session = make({
      sub: "user-123",
      role: "operator",
      operatorId: "op-1",
      driverId: null,
      customerId: null,
    })
    expect(session.user.role).toBe("operator")
    expect(session.user.operatorId).toBe("op-1")
    expect(session.user.driverId).toBeNull()
    expect(session.user.customerId).toBeNull()
  })
})
