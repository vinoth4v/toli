import { boundsFor, embedUrl, mapLink, navigationLink, type Point } from "@/domain/geo"

/**
 * A map, embedded.
 *
 * An iframe rather than a mapping library: the blessed-dependency list has no
 * map renderer in it, and adding one would put a few hundred kilobytes of
 * JavaScript in front of a customer on a phone to draw a dot. OpenStreetMap's
 * embed needs no key, no billing account and no client bundle at all.
 *
 * Beside every map is a link out to Google Maps, because §6.1 is right that
 * Indian street data is better there and that navigation should be handed to
 * the app the person already uses. The embed answers "where is it"; the link
 * answers "take me there".
 */

export function MapEmbed({
  point,
  label,
  height = 260,
  navigate = false,
}: {
  point: Point
  label: string
  height?: number
  navigate?: boolean
}) {
  return (
    <figure className="map">
      <iframe
        src={embedUrl(point)}
        title={label}
        loading="lazy"
        style={{ height: `${height}px` }}
      />
      {/* The caption carries the position in words as well as pixels. OSM's
          tile server answers a request without a proper referer with a blank
          103-byte image, and a map that fails to a grey rectangle should still
          tell you where the vehicle is. */}
      <figcaption>
        <span className="muted small">
          {label} · {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
        </span>
        <span className="map-links">
          <a href={mapLink(point)} rel="noreferrer noopener" target="_blank">
            Open in Maps
          </a>
          {navigate ? (
            <a href={navigationLink(point)} rel="noreferrer noopener" target="_blank">
              Navigate
            </a>
          ) : null}
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * The whole route on one map, framed so every stop fits.
 *
 * Only the centre carries a marker — the embed takes one — so the caption
 * names the stops in order. It is a picture of roughly where this trip goes,
 * which is what somebody deciding whether to book actually wants.
 */
export function RouteMap({
  points,
  labels,
  height = 260,
}: {
  points: readonly Point[]
  labels: readonly string[]
  height?: number
}) {
  const bounds = boundsFor(points)
  if (!bounds) return null

  return (
    <figure className="map">
      <iframe
        src={embedUrl(bounds.centre, bounds.span)}
        title={labels.join(" to ")}
        loading="lazy"
        style={{ height: `${height}px` }}
      />
      <figcaption>
        <span className="muted small">{labels.join(" → ")}</span>
        <span className="map-links">
          <a href={mapLink(bounds.centre)} rel="noreferrer noopener" target="_blank">
            Open in Maps
          </a>
        </span>
      </figcaption>
    </figure>
  )
}
