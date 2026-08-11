"use client"

import { useState, useTransition } from "react"
import { presignAvatarAction, recordAvatarAction, removeAvatarAction } from "@/app/account/actions"

/**
 * Uploading a profile photo — the same two steps as a vehicle photo: ask for a
 * presigned URL, PUT straight to the bucket. No URL field, deliberately;
 * pasting links to your own face is nobody's idea of a profile page.
 */

export function AvatarUpload({ hasAvatar }: { hasAvatar: boolean }) {
  const [status, setStatus] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function upload(file: File): Promise<void> {
    setStatus("Uploading…")

    const presigned = await presignAvatarAction({ filename: file.name })
    if ("error" in presigned) {
      setStatus(presigned.error)
      return
    }

    const response = await fetch(presigned.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "image/jpeg" },
    })

    if (!response.ok) {
      setStatus(`Storage refused the upload (${response.status}).`)
      return
    }

    startTransition(async () => {
      await recordAvatarAction({ url: presigned.publicUrl, storageKey: presigned.storageKey })
      setStatus("Done.")
    })
  }

  return (
    <div className="upload">
      <label htmlFor="avatar-file">Profile photo</label>
      <input
        id="avatar-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />
      {hasAvatar ? (
        <button
          type="button"
          className="quiet"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await removeAvatarAction()
              setStatus("Removed — back to initials.")
            })
          }
        >
          Remove photo
        </button>
      ) : null}
      {status ? <p className="hint">{status}</p> : null}
    </div>
  )
}
