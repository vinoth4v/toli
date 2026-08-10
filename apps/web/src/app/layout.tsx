import { color } from "@werft/tokens"
import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
// Tokens first: globals.css consumes the custom properties this defines.
import "@werft/tokens/tokens.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "TOLI — charter desk",
  description:
    "Book a whole van or bus for your whole group: enquiries, operator quotes, bookings and settlement in one place.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: color.bg.light },
    { media: "(prefers-color-scheme: dark)", color: color.bg.dark },
  ],
}

/**
 * Deliberately free of anything that reads a session or the environment.
 *
 * The 404 page is prerendered at build time against this layout, and `next
 * build` has to succeed with no AUTH_SECRET and no database. The signed-in
 * chrome lives in the (app) route group's layout instead, which every real
 * page passes through and which is dynamic by definition.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
