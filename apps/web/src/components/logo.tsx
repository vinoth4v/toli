/**
 * The Toli mark.
 *
 * A trip, reduced to its atoms: the dot where the group is, the road, the pin
 * where they are going. One continuous stroke inside a rounded plate, so it
 * survives being a favicon, an app icon, a WhatsApp avatar and a rubber stamp
 * on an operator agreement without redrawing.
 *
 * Drawn in currentColor so the same component is ink-on-paper in the header
 * and paper-on-ink in the footer — the mark has no colours of its own, which
 * is the entire brand position: colour is spent on meaning (live, settled,
 * stop), never on decoration.
 */

export function ToliMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="currentColor" />
      {/* Origin dot */}
      <circle cx="16" cy="15" r="3.6" fill="var(--logo-contrast, var(--color-bg))" />
      {/* The road between */}
      <path
        d="M16 15 C 16 28, 32 20, 32 33"
        stroke="var(--logo-contrast, var(--color-bg))"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      {/* Destination pin */}
      <circle cx="32" cy="33" r="6" fill="var(--logo-contrast, var(--color-bg))" />
      <circle cx="32" cy="33" r="2.4" fill="currentColor" />
    </svg>
  )
}

/** Mark plus wordmark, for headers and the footer. */
export function ToliLogo({ size = 34, sub }: { size?: number; sub?: string }) {
  return (
    <span className="logo">
      <ToliMark size={size} />
      <span className="logo-word">
        toli
        {sub ? <small>{sub}</small> : null}
      </span>
    </span>
  )
}
