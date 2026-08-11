import Link from "next/link"
import type { ReactNode } from "react"
import { signOutAction } from "@/app/actions"
import { auth } from "@/auth"

/**
 * The console shell.
 *
 * Everything inside this route group is behind the operator gate. The public
 * tracking page and the login page sit outside it deliberately — a wedding
 * guest opening a tracking link must not see a navigation bar into Toli's
 * settlement screens.
 */

export const dynamic = "force-dynamic"

const NAV = [
  { href: "/console", label: "Control tower" },
  { href: "/console/rfqs", label: "RFQs" },
  { href: "/console/bookings", label: "Bookings" },
  { href: "/console/operators", label: "Operators" },
  { href: "/console/fleet", label: "Fleet" },
  { href: "/console/compliance", label: "Compliance" },
  { href: "/console/integrations", label: "Integrations" },
  { href: "/console/settings", label: "Settings" },
]

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  return (
    <div className="shell">
      <header className="masthead">
        <Link href="/console" className="wordmark">
          toli
          <small>ops console</small>
        </Link>
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOutAction}>
          <button type="submit" title={session?.user?.email ?? undefined}>
            Sign out
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  )
}
