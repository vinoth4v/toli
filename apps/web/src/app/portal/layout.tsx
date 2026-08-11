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
  const [session, { locale, t }] = await Promise.all([auth(), translations()])
  if (!session?.user) redirect("/login")
  if (session.user.role !== "customer") redirect(homeFor(session.user.role))
  const avatar = await avatarUrlFor(session.user.id)

  return (
    <div className="shell portal">
      <header className="portal-top">
        <Link href="/portal" className="wordmark-link">
          <ToliLogo sub={t.portalYourTrips.toLowerCase()} />
        </Link>
        <nav>
          <Link href="/portal">{t.portalYourTrips}</Link>
          <Link href="/portal/book">{t.portalBookNow}</Link>
          <Link href="/portal/new">{t.portalAskForVehicle}</Link>
        </nav>
        <div className="portal-top-right">
          <LanguageSwitch locale={locale} />
          <Link href="/account" className="avatar-link" aria-label={session.user.name ?? t.signOut}>
            <Avatar name={session.user.name ?? "?"} url={avatar} size={36} />
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
