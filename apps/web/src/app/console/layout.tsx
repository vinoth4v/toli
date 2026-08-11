import Link from "next/link"
import type { ReactNode } from "react"
import { auth } from "@/auth"
import { Avatar } from "@/components/avatar"
import { ToliLogo } from "@/components/logo"
import { avatarUrlFor } from "@/data/users"

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
  const avatar = await avatarUrlFor(session?.user.id)

  return (
    <div className="shell">
      <header className="masthead">
        <Link href="/console" className="wordmark-link">
          <ToliLogo size={30} sub="ops console" />
        </Link>
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/account" className="avatar-link" aria-label="Your account">
          <Avatar name={session?.user?.name ?? "Ops"} url={avatar} size={34} />
        </Link>
      </header>
      <main>{children}</main>
    </div>
  )
}
