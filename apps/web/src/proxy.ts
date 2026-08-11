import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Next 16 calls this convention "proxy"; it is what earlier versions called
// middleware, and it still runs before every matched request.
export default NextAuth(authConfig).auth

/**
 * Everything is private unless listed here. Closed by default is the whole
 * point of the single-user gate: a new route is protected because it exists,
 * not because someone remembered to protect it.
 *
 * icon.svg is where Next serves app/icon.svg from — without the exemption,
 * the favicon 307s to /login for anyone signed out and the tab shows a
 * broken icon. Any future route that must be reachable without a session
 * (an API other services call, say) needs its own entry here too, or every
 * caller silently gets a redirect instead of the route.
 *
 * There are three deliberate holes, and each carries its own credential
 * because none of them can carry the operator's session.
 *
 * `track` — the guest tracking link of §4.1, which has to work with no app
 * and no login, because sixty wedding guests are not going to sign in to find
 * out where the bus is. Its unguessable token is the credential, and the page
 * behind it is a narrow projection: no price, no phone numbers, no SOS events.
 *
 * `api/ingest` — where the driver app and AIS-140 VLTD boxes post positions.
 * Authenticated per device by a bearer token whose SHA-256 is all this app
 * stores, so a device can write a position and reach nothing else.
 *
 * `api/webhooks` — where payment providers call back. Authenticated by an
 * HMAC over the raw body, verified before the body is even parsed.
 */
export const config = {
  matcher: [
    // `/$` — the marketplace's own front page — is matched by nothing here on
    // purpose. It decides for itself: a visitor sees the marketplace, and a
    // signed-in operator is redirected straight to /console, so nobody has to
    // click past a welcome page to reach the app they run.
    "/((?!$|api/auth|api/ingest|api/webhooks|login|register|track|_next/static|_next/image|favicon.ico|icon.svg).*)",
    // Every role surface is matched, so authorisation runs before any of them
    // renders. `authorized` in auth.config.ts decides which role may be where.
  ],
}
