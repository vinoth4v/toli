import Link from "next/link"
import { signOutAction } from "@/app/actions"
import { auth } from "@/auth"

/**
 * The nav, which exists only once someone is signed in.
 *
 * Rendered from the root layout so every page gets it without remembering to,
 * and returning null when there is no session keeps it off the login page —
 * a nav full of links that all bounce back to /login is worse than no nav.
 */
export async function SiteHeader() {
  const session = await auth()
  if (!session?.user) return null

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/">
          TOLI
        </Link>
        <nav className="site-nav">
          <Link href="/">Dashboard</Link>
          <Link href="/enquiries">Enquiries</Link>
          <Link href="/bookings">Bookings</Link>
          <Link href="/operators">Operators</Link>
        </nav>
        <span className="small muted">{session.user.email}</span>
        <form action={signOutAction}>
          <button className="secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
