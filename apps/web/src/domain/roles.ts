/**
 * Who may see what.
 *
 * §3 of the build plan names five surfaces and is explicit that the driver is
 * a distinct user from the operator — "if you merge them, you'll either give
 * the driver access to commercial data (he'll learn your take rate and
 * disintermediate you) or you'll cripple the operator's app". That sentence is
 * the whole reason this file exists: the roles are not decoration on one
 * interface, they are different people with genuinely different rights.
 *
 * Everything here is a pure function of a role and a path, so the same rules
 * decide what the edge middleware allows, what a layout renders, and what the
 * tests assert. There is no second copy of the rules to drift.
 */

export const ROLES = ["admin", "customer", "operator", "driver"] as const

export type Role = (typeof ROLES)[number]

export type RoleInfo = {
  key: Role
  label: string
  /** Where this role lands after signing in, and what the root path redirects to. */
  home: string
  /** Every path prefix this role may reach. Order matters only for readability. */
  allows: string[]
  /** One line, shown on the sign-in page and in the account switcher. */
  purpose: string
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  admin: {
    key: "admin",
    label: "Toli ops",
    home: "/console",
    allows: ["/console"],
    purpose: "Verification queue, matching desk, disputes, pricing, payouts, fraud.",
  },
  customer: {
    key: "customer",
    label: "Group organiser",
    home: "/portal",
    allows: ["/portal"],
    purpose: "Ask for a vehicle, compare quotes honestly, pay, and watch the trip.",
  },
  operator: {
    key: "operator",
    label: "Fleet operator",
    home: "/partner",
    allows: ["/partner"],
    purpose: "Quote fast, manage the fleet's paperwork, and see exactly what you are paid.",
  },
  driver: {
    key: "driver",
    label: "Driver",
    home: "/drive",
    allows: ["/drive"],
    purpose: "Today's trip, in three big buttons, on a phone with a cracked screen.",
  },
}

export function roleLabel(role: Role): string {
  return ROLE_INFO[role].label
}

export function homeFor(role: Role): string {
  return ROLE_INFO[role].home
}

/**
 * Whether a role may reach a path.
 *
 * Deliberately a prefix test against an allow-list rather than a deny-list: a
 * route added tomorrow is unreachable by every role until somebody says
 * otherwise, which is the same "closed by default" posture the single-operator
 * gate had and the only one that survives a growing app.
 *
 * The boundary check (`/portalx` must not match `/portal`) is the bug this
 * would otherwise have, and it is why the segment is compared rather than the
 * raw string.
 */
export function mayAccess(role: Role, path: string): boolean {
  return ROLE_INFO[role].allows.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/** Paths anyone may reach, signed in or not. */
export const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/track",
  "/api/auth",
  "/api/ingest",
  "/api/webhooks",
]

export function isPublic(path: string): boolean {
  if (path === "/") return true
  return PUBLIC_PREFIXES.some(
    (prefix) => prefix !== "/" && (path === prefix || path.startsWith(`${prefix}/`)),
  )
}

/**
 * What an operator user may see about money.
 *
 * The plan's warning is specific and worth encoding rather than remembering:
 * a driver must never see commercial data, because a driver who learns the
 * take rate can take the customer off-platform next time. So the *driver* role
 * has no access to any price, anywhere — not a quote, not a settlement, not
 * the trip value — and this is the function that says so.
 */
export function maySeeMoney(role: Role): boolean {
  return role !== "driver"
}

/** Only Toli's own staff see another party's margins. */
export function maySeeCommission(role: Role): boolean {
  return role === "admin"
}
