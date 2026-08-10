import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"

// Reads the session cookie, so there is nothing here to prerender.
export const dynamic = "force-dynamic"

/**
 * Everything behind the gate shares this chrome.
 *
 * A route group rather than a path segment: the URLs stay "/enquiries" and
 * "/bookings" with no "(app)" in them, and /login stays outside so it does not
 * get a nav full of links that would only bounce back to itself.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  )
}
