import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { auth } from "@/auth"
import { Avatar } from "@/components/avatar"
import { LanguageSwitch } from "@/components/language"
import { ToliLogo } from "@/components/logo"
import { avatarUrlFor } from "@/data/users"
import { homeFor } from "@/domain/roles"
import { translations } from "@/i18n"

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
  const [session, { locale }] = await Promise.all([auth(), translations()])
  if (!session?.user) redirect("/login")
  if (session.user.role !== "driver") redirect(homeFor(session.user.role))
  const avatar = await avatarUrlFor(session.user.id)

  return (
    <div className="drive">
      <header className="drive-top">
        <ToliLogo sub="driver" />
        <div className="drive-top-right">
          <LanguageSwitch locale={locale} />
          <Link href="/account" className="avatar-link" aria-label={session.user.name ?? "Account"}>
            <Avatar name={session.user.name ?? "?"} url={avatar} size={40} />
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
