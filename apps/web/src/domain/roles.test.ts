import { describe, expect, it } from "vitest"
import { homeFor, isPublic, mayAccess, maySeeCommission, maySeeMoney, ROLES } from "./roles.ts"

describe("mayAccess", () => {
  it("lets each role into its own surface and no other", () => {
    expect(mayAccess("admin", "/console/settings")).toBe(true)
    expect(mayAccess("admin", "/partner")).toBe(false)

    expect(mayAccess("customer", "/portal/trips")).toBe(true)
    expect(mayAccess("customer", "/console")).toBe(false)

    expect(mayAccess("operator", "/partner/fleet")).toBe(true)
    expect(mayAccess("operator", "/console/settings")).toBe(false)

    expect(mayAccess("driver", "/drive")).toBe(true)
    expect(mayAccess("driver", "/partner")).toBe(false)
  })

  it("does not let a prefix match across a path boundary", () => {
    // /portalx is not inside /portal, and a naive startsWith would say it is.
    expect(mayAccess("customer", "/portalx")).toBe(false)
    expect(mayAccess("customer", "/portal-admin")).toBe(false)
    expect(mayAccess("admin", "/consoles")).toBe(false)
  })

  it("closes a route nobody has been granted yet", () => {
    // Closed by default: a route added tomorrow is unreachable until somebody
    // says otherwise, for every role.
    for (const role of ROLES) {
      expect(mayAccess(role, "/some-new-surface"), role).toBe(false)
    }
  })
})

describe("the account page", () => {
  it("is the one surface every role shares", () => {
    // A driver has no business in the console, but everyone has a face and a
    // language, and duplicating that screen four times is how they drift apart.
    for (const role of ROLES) {
      expect(mayAccess(role, "/account"), role).toBe(true)
    }
  })
})

describe("homeFor", () => {
  it("sends each role somewhere it is allowed to be", () => {
    for (const role of ROLES) {
      expect(mayAccess(role, homeFor(role)), role).toBe(true)
    }
  })

  it("gives every role a different home", () => {
    const homes = ROLES.map(homeFor)
    expect(new Set(homes).size).toBe(ROLES.length)
  })
})

describe("isPublic", () => {
  it("opens the front page, sign-in, tracking and the machine endpoints", () => {
    expect(isPublic("/")).toBe(true)
    expect(isPublic("/login")).toBe(true)
    expect(isPublic("/track/abc123")).toBe(true)
    expect(isPublic("/api/ingest/ping")).toBe(true)
    expect(isPublic("/api/webhooks/razorpay")).toBe(true)
  })

  it("keeps every role surface closed", () => {
    for (const path of ["/console", "/portal", "/partner", "/drive"]) {
      expect(isPublic(path), path).toBe(false)
    }
  })

  it("does not let a lookalike path pass as public", () => {
    expect(isPublic("/trackers")).toBe(false)
    expect(isPublic("/logins")).toBe(false)
  })
})

describe("what money each role may see", () => {
  it("shows no price of any kind to a driver", () => {
    // §3: merge the driver into the operator and he learns the take rate, then
    // takes the customer off-platform. The rule is worth encoding, not
    // remembering.
    expect(maySeeMoney("driver")).toBe(false)
    expect(maySeeMoney("operator")).toBe(true)
    expect(maySeeMoney("customer")).toBe(true)
    expect(maySeeMoney("admin")).toBe(true)
  })

  it("shows commission only to Toli's own staff", () => {
    expect(maySeeCommission("admin")).toBe(true)
    for (const role of ["customer", "operator", "driver"] as const) {
      expect(maySeeCommission(role), role).toBe(false)
    }
  })
})
