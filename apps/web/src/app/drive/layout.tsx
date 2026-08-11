import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { signOutAction } from "@/app/actions"
import { auth } from "@/auth"
import { homeFor } from "@/domain/roles"

/**
 * Toli Driver.
 *
 * §4.3: "deliberately minimal — three big buttons, works on a bad phone, works
 * offline". This is the surface most unlike the others and the one where
 * restraint is the feature. Sub-₹12,000 Android, one hand, in sunlight, at
 * 5 AM, by someone who is not going to read a paragraph.
 *
 * So: huge touch targets, one screen per trip, icons where a word would need
 * translating, and — enforced in the data layer, not just here — no money
 * anywhere. §3 is explicit that a driver who learns the commercial terms is a
 * driver who can take the customer off-platform next time.
 */

export const dynamic = "force-dynamic"

export default async function DriveLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role !== "driver") redirect(homeFor(session.user.role))

  return (
    <div className="drive">
      <header className="drive-top">
        <span className="wordmark">
          toli<span className="tag">driver</span>
        </span>
        <form action={signOutAction}>
          <button type="submit" className="quiet">
            {session.user.name}
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  )
}
