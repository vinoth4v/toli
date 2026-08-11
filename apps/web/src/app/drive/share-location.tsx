"use client"

import { useState, useTransition } from "react"
import { shareLocationAction } from "./actions"

/**
 * The driver's phone reporting where it is.
 *
 * §6.3 wants a background service pinging every ten seconds, which a web page
 * cannot do — a browser stops running JavaScript when the screen locks, and no
 * amount of wanting changes that. What a web page *can* do is ask for a fix
 * while it is open, so this is honest about being the interim: a large button
 * that sends one position, and an optional repeat while the driver keeps the
 * screen on.
 *
 * The one client component in the app, because `navigator.geolocation` has no
 * server-side equivalent. It sends through a server action rather than the
 * ingest endpoint, so the driver's own session is the credential and no token
 * has to live on a phone.
 */

const REPEAT_MS = 60_000

type State = "idle" | "sharing" | "shared" | "denied" | "unavailable"

export function ShareLocation({ bookingId, label }: { bookingId: string; label: string }) {
  const [state, setState] = useState<State>("idle")
  const [repeating, setRepeating] = useState(false)
  const [pending, startTransition] = useTransition()

  function sendOnce(): void {
    if (!("geolocation" in navigator)) {
      setState("unavailable")
      return
    }

    setState("sharing")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(async () => {
          await shareLocationAction({
            bookingId,
            lat: String(position.coords.latitude),
            lng: String(position.coords.longitude),
            speedKmph:
              position.coords.speed === null ? null : Math.round(position.coords.speed * 3.6),
          })
          setState("shared")
        })
      },
      () => setState("denied"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
  }

  function toggleRepeat(): void {
    setRepeating((was) => {
      if (was) return false
      sendOnce()
      // Kept deliberately simple: the interval dies with the page, which is
      // the same moment the browser stops being able to report anyway.
      const timer = setInterval(sendOnce, REPEAT_MS)
      window.addEventListener("pagehide", () => clearInterval(timer), { once: true })
      return true
    })
  }

  return (
    <div className="share-location">
      <button type="button" className="huge" onClick={sendOnce} disabled={pending}>
        {label}
      </button>

      <label htmlFor="repeat" className="repeat">
        <input id="repeat" type="checkbox" checked={repeating} onChange={toggleRepeat} />
        Keep sharing while this screen is open
      </label>

      <p className="hint">
        {state === "shared"
          ? "Sent. The customer's tracking link now shows this position."
          : state === "denied"
            ? "Location permission was refused. Allow it in your browser to share."
            : state === "unavailable"
              ? "This phone cannot report its location to a web page."
              : "Sends where you are now, so the family watching the link can see the vehicle."}
      </p>
    </div>
  )
}
