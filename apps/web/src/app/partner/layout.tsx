import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { signOutAction } from "@/app/actions"
import { auth } from "@/auth"
import { homeFor } from "@/domain/roles"

/**
 * Toli Partner — the fleet operator's own screen.
 *
 * This person opens it forty times a day between phone calls, so it is the
 * opposite of the customer portal: dense, tabular, keyboard-friendly, and
 * organised around the one thing that decides whether they make money — how
 * fast they answer an RFQ. §4.2 puts response rate at the centre, so the quote
 * inbox is the home page and everything else is a tab away from it.
 */

export const dynamic = "force-dynamic"

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role !== "operator") redirect(homeFor(session.user.role))

  return (
    <div className="shell partner">
      <header className="partner-top">
        <Link href="/partner" className="wordmark">
          toli<span className="tag">partner</span>
        </Link>
        <nav>
          <Link href="/partner">Quote inbox</Link>
          <Link href="/partner/fleet">Fleet</Link>
          <Link href="/partner/earnings">Earnings</Link>
        </nav>
        <form action={signOutAction}>
          <button type="submit" className="quiet">
            Sign out
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  )
}
