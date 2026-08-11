import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { verifyPassword } from "@/auth/password"
import { authConfig } from "@/auth.config"
import { findUserByEmail, normaliseEmail, recordSignIn } from "@/data/users"
import { recordEvent } from "@/db/events"
import type { Role } from "@/domain/roles"
import { env } from "@/env"

const submitted = z.object({
  email: z.email(),
  password: z.string().min(1),
})

/**
 * Sign-in, against the user store.
 *
 * §3 needs four kinds of person — Toli's own staff, the group organiser, the
 * fleet operator and the driver — and the plan is emphatic that the driver in
 * particular must be a separate identity, because a driver who can see
 * commercial data is a driver who can take the customer off-platform. So the
 * role travels in the session token and decides which application the person
 * reaches, before any page renders.
 *
 * The environment identity the template shipped with survives as **break-glass
 * access**: if the user table is empty, unreachable, or somebody has locked
 * themselves out, `WERFT_USER_EMAIL` and `WERFT_PASSWORD_HASH` still sign in as
 * an admin. That is deliberate. A multi-user app whose only administrator is a
 * row in a database it cannot reach is an app with no way back in.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = submitted.safeParse(raw)
        if (!parsed.success) return null

        const email = normaliseEmail(parsed.data.email)
        const { password } = parsed.data

        // Break-glass first, and without touching the database, so it works
        // precisely when the database is the thing that is broken.
        const { WERFT_USER_EMAIL, WERFT_PASSWORD_HASH } = env()
        const isBreakGlass = email === normaliseEmail(WERFT_USER_EMAIL)
        if (isBreakGlass) {
          if (!verifyPassword(password, WERFT_PASSWORD_HASH)) {
            await recordEvent("sign_in_failed", email)
            return null
          }

          await recordEvent("sign_in", email, "break-glass admin")
          return {
            id: "break-glass",
            email: WERFT_USER_EMAIL,
            name: "Toli ops",
            role: "admin" satisfies Role,
          }
        }

        const user = await findUserByEmail(email)

        // Both checks always run for a known address, so a wrong password and
        // a disabled account take the same time and neither can be probed for.
        const passwordMatches = user ? verifyPassword(password, user.passwordHash) : false

        if (!user || !passwordMatches || !user.active) {
          await recordEvent(
            "sign_in_failed",
            email,
            user ? "bad password or disabled" : "no such user",
          )
          return null
        }

        await recordSignIn(user.id)
        await recordEvent("sign_in", email, user.role)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          operatorId: user.operatorId,
          driverId: user.driverId,
          customerId: user.customerId,
        }
      },
    }),
  ],
})
