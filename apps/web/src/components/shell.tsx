import Link from "next/link"
import type { ReactNode } from "react"
import { signOutAction } from "@/app/actions"

/**
 * The frame every signed-in page sits in.
 *
 * Not in the root layout, because the login page shares that layout and must
 * not show navigation to somebody who has not signed in yet.
 */
export function Shell({ email, children }: { email?: string | null; children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="Toli — the desk">
            <GroupMark />
            <span className="brand-word">toli</span>
          </Link>

          <nav className="nav" aria-label="Sections">
            <Link href="/">Desk</Link>
            <Link href="/requests">Requests</Link>
            <Link href="/operators">Operators</Link>
            <Link href="/bookings">Bookings</Link>
          </nav>

          <form action={signOutAction} className="signout">
            <span className="who">{email ?? "operator"}</span>
            <button type="submit" className="ghost">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="app">{children}</main>
    </>
  )
}

/**
 * The group mark: three figures moving together, so the meaning of the word
 * is legible before the word is. Drawn with currentColor rather than a hex,
 * for the same reason nothing in the stylesheet carries a literal colour.
 */
function GroupMark() {
  return (
    <svg viewBox="0 0 36 24" width="30" height="20" focusable="false" aria-hidden="true">
      <circle cx="7" cy="7" r="4" fill="currentColor" />
      <circle cx="18" cy="5.5" r="4.5" fill="currentColor" />
      <circle cx="29" cy="7" r="4" fill="currentColor" />
      <path
        d="M1 22c0-4 2.7-7 6-7s6 3 6 7zM11 23c0-4.4 3.1-8 7-8s7 3.6 7 8zM23 22c0-4 2.7-7 6-7s6 3 6 7z"
        fill="currentColor"
      />
    </svg>
  )
}
