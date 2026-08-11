import type { DefaultSession } from "next-auth"
import type { Role } from "@/domain/roles"

/**
 * What a Toli session carries beyond the defaults.
 *
 * The role is the important one: every layout and every server action reads it
 * to decide what may be shown, and typing it here is what stops that becoming
 * a string compared against a typo.
 *
 * The three ids are the person's identity on the other side of the app — an
 * operator user's operator, a driver user's driver, a customer's customer —
 * so a query can be scoped to "yours" without a second lookup on every page.
 */
declare module "next-auth" {
  interface Session {
    user: {
      role: Role
      operatorId: string | null
      driverId: string | null
      customerId: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role: Role
    operatorId?: string | null
    driverId?: string | null
    customerId?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role
    operatorId?: string | null
    driverId?: string | null
    customerId?: string | null
  }
}
