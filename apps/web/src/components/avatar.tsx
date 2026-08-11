/**
 * A face, or failing that, a name.
 *
 * Initials are the default state of every account, not an error state — so
 * they are drawn deliberately: ink disc, paper letters, the same two tokens as
 * every button. An uploaded photo replaces them; a broken photo URL falls back
 * to them via object-fit over the lettered disc rather than a torn-image glyph.
 */

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return `${first}${second}`.toUpperCase()
}

export function Avatar({
  name,
  url,
  size = 32,
}: {
  name: string
  url?: string | null
  size?: number
}) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      <span aria-hidden="true">{initialsOf(name)}</span>
      {url ? (
        // biome-ignore lint/performance/noImgElement: operator-supplied hosts; next/image needs a per-bucket allowlist
        <img src={url} alt={name} loading="lazy" />
      ) : null}
    </span>
  )
}
