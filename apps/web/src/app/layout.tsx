import { color } from "@werft/tokens"
import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
// Tokens first: globals.css consumes the custom properties this defines.
import "@werft/tokens/tokens.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "Toli — the whole group, one vehicle",
  description:
    "The desk behind Toli: charter requirements in, structured quotes back, landed cost compared, one operator awarded.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: color.bg.light },
    { media: "(prefers-color-scheme: dark)", color: color.bg.dark },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
