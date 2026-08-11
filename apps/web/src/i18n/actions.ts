"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { isLocale, LOCALE_COOKIE } from "./index.ts"

/**
 * Switching language.
 *
 * A cookie rather than a URL segment: the driver app is opened from a home
 * screen shortcut and the portal from a WhatsApp link, and neither should
 * carry `/ta/` through every link for the rest of its life. One year, because
 * choosing Tamil is a fact about the reader, not about the session.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const value = String(formData.get("locale") ?? "")
  if (!isLocale(value)) return

  const store = await cookies()
  store.set(LOCALE_COOKIE, value, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  })

  revalidatePath("/", "layout")
}
