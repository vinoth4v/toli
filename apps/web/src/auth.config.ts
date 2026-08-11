import type { NextAuthConfig } from "next-auth"
import { homeFor, mayAccess, type Role } from "@/domain/roles"

/**
 * The half of the auth config that must run at the edge.
 *
 * Middleware is bundled for the edge runtime, so this file may not reach for
 * anything Node-only. The Credentials provider needs `node:crypto`, so it
 * lives in auth.ts and is composed on top of this.
 *
 * The role lives in the JWT, which is what lets authorisation happen here —
 * before a route renders, without a database round trip on every request. The
 * cost of that is the usual one for stateless tokens: a role changed in the
 * database takes effect on the user's next sign-in, not instantly. For four
 * accounts that is the right trade; a revocation list is what changes it.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on the request that signs in; afterwards the
      // token carries what was decided then.
      if (user) {
        token.role = user.role
        token.operatorId = user.operatorId ?? null
        token.driverId = user.driverId ?? null
        token.customerId = user.customerId ?? null
      }
      return token
    },

    session({ session, token }) {
      session.user.role = (token.role as Role) ?? "admin"
      session.user.operatorId = (token.operatorId as string | null) ?? null
      session.user.driverId = (token.driverId as string | null) ?? null
      session.user.customerId = (token.customerId as string | null) ?? null
      return session
    },

    /**
     * The gate, now role-aware.
     *
     * Returning false sends an anonymous visitor to sign in. A *signed-in*
     * visitor on somebody else's surface is a different problem — they are
     * authenticated but not authorised — so they are redirected to their own
     * home rather than bounced to a login form they have already passed.
     */
    authorized({ auth, request }) {
      const user = auth?.user
      if (!user) return false

      const role = (user.role as Role) ?? "admin"
      const path = request.nextUrl.pathname

      if (mayAccess(role, path)) return true

      return Response.redirect(new URL(homeFor(role), request.nextUrl))
    },
  },
  providers: [],
} satisfies NextAuthConfig
