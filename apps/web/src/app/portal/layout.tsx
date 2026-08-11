import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { signOutAction } from "@/app/actions"
import { auth } from "@/auth"
import { homeFor } from "@/domain/roles"

/**
 * Toli for the person organising the trip.
 *
 * A different shape from the console on purpose. This person books a bus once
 * a year — for a wedding, a school trip, a pilgrimage — so nothing here
 * assumes they remember how it worked last time, or what a "bata" is. Wide
 * calm cards, one action per screen, and the vocabulary of a passenger rather
 * than a dispatcher.
 */

export const dynamic = "force-dynamic"

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role !== "customer") redirect(homeFor(session.user.role))

  return (
    <div className="shell portal">
      <header className="portal-top">
        <Link href="/portal" className="wordmark">
          toli
          <small>your trips</small>
        </Link>
        <nav>
          <Link href="/portal">Trips</Link>
          <Link href="/portal/new">Ask for a vehicle</Link>
        </nav>
        <form action={signOutAction}>
          <button type="submit" className="quiet">
            {session.user.name ?? "Sign out"}
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  )
}
