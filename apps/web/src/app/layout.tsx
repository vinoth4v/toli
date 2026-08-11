import { THEMES } from "@werft/tokens"
import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
// Tokens first: globals.css consumes the custom properties this defines.
import "@werft/tokens/tokens.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "Toli — ops console",
  description:
    "Book a whole van or bus for your whole group. Toli's ops console: RFQs, structured quotes, verified operators, settlements.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEMES.toli.color.bg.light },
    { media: "(prefers-color-scheme: dark)", color: THEMES.toli.color.bg.dark },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
