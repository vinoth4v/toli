import Link from "next/link"
import { redirect } from "next/navigation"
import { signOutAction } from "@/app/actions"
import { auth } from "@/auth"
import { Avatar } from "@/components/avatar"
import { AvatarUpload } from "@/components/avatar-upload"
import { LanguageSwitch } from "@/components/language"
import { ToliLogo } from "@/components/logo"
import { getUserById } from "@/data/users"
import { homeFor, ROLE_INFO } from "@/domain/roles"
import { translations } from "@/i18n"

/**
 * The one page every role shares: your face, your language, your way out.
 *
 * Four surfaces would otherwise each grow their own profile corner and drift.
 * Everything identity-shaped lives here instead, and each surface just shows
 * the avatar linking in.
 */

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const [session, { locale }] = await Promise.all([auth(), translations()])
  if (!session?.user) redirect("/login")

  const id = session.user.id
  const user = !id || id === "break-glass" ? null : await getUserById(id)
  const name = user?.name ?? session.user.name ?? "Operator"

  return (
    <main className="narrow account">
      <Link href={homeFor(session.user.role)} className="wordmark-link">
        <ToliLogo sub={ROLE_INFO[session.user.role].label.toLowerCase()} />
      </Link>

      <p className="crumb">
        <Link href={homeFor(session.user.role)}>← Back</Link>
      </p>

      <section className="account-card">
        <Avatar name={name} url={user?.avatarUrl} size={88} />
        <div>
          <h1>{name}</h1>
          <p className="muted small">
            {user?.email ?? session.user.email} · {ROLE_INFO[session.user.role].label}
          </p>
        </div>
      </section>

      <section className="account-card">
        <AvatarUpload hasAvatar={Boolean(user?.avatarUrl)} />
      </section>

      <section className="account-card">
        <p className="who-label">Language</p>
        <LanguageSwitch locale={locale} />
      </section>

      <form action={signOutAction}>
        <button type="submit" className="quiet">
          Sign out
        </button>
      </form>
    </main>
  )
}
