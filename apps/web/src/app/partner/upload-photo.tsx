"use client"

import { useState, useTransition } from "react"
import { presignPhotoAction, recordPhotoAction } from "./actions"

/**
 * Uploading a photograph of a vehicle.
 *
 * Two steps, both from the browser: ask the server for a presigned URL, then
 * PUT the file straight to the bucket. The image never travels through this
 * app, which keeps a four-megabyte photo off a function billed by the
 * millisecond — and means an upload that fails, fails against storage rather
 * than timing out somewhere in the middle.
 *
 * §4.1 asks for real photos rather than stock images, so the copy asks for the
 * vehicle rather than a picture, and the kinds are the four §4.2 lists.
 */

const KINDS = [
  { value: "exterior", label: "Outside" },
  { value: "interior", label: "Inside" },
  { value: "seats", label: "Seats" },
  { value: "boot", label: "Luggage space" },
]

export function UploadPhoto({
  vehicleId,
  registration,
}: {
  vehicleId: string
  registration: string
}) {
  const [kind, setKind] = useState("exterior")
  const [status, setStatus] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function upload(file: File): Promise<void> {
    setStatus("Preparing…")

    const presigned = await presignPhotoAction({ vehicleId, filename: file.name })
    if ("error" in presigned) {
      setStatus(presigned.error)
      return
    }

    setStatus("Uploading…")
    const response = await fetch(presigned.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "image/jpeg" },
    })

    if (!response.ok) {
      // The signature, the bucket policy or the network — and the operator
      // cannot tell which, so say what is knowable and keep the link fallback.
      setStatus(`Storage refused the upload (${response.status}). Try the link option below.`)
      return
    }

    startTransition(async () => {
      await recordPhotoAction({
        vehicleId,
        url: presigned.publicUrl,
        storageKey: presigned.storageKey,
        kind,
        caption: null,
      })
      setStatus("Added.")
    })
  }

  return (
    <div className="upload">
      <label htmlFor={`kind-${vehicleId}`}>What does the photo show?</label>
      <select
        id={`kind-${vehicleId}`}
        value={kind}
        onChange={(event) => setKind(event.target.value)}
      >
        {KINDS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label htmlFor={`file-${vehicleId}`}>Photo of {registration}</label>
      <input
        id={`file-${vehicleId}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      {status ? <p className="hint">{status}</p> : null}
    </div>
  )
}
