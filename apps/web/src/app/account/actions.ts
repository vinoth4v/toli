"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { uploadToken } from "@/data/fleet"
import { setAvatar } from "@/data/users"
import { avatarKey, presignPut, publicUrl, storageConfig } from "@/integrations/storage"

/**
 * A person's own face. The session is the only authorisation that makes sense
 * here: you may change your avatar, and there is no id in any form to tamper
 * with — the break-glass admin has no row and is told so rather than erroring.
 */

async function userId(): Promise<string> {
  const session = await auth()
  const id = session?.user.id
  if (!id) redirect("/login")
  return id
}

export async function presignAvatarAction(input: {
  filename: string
}): Promise<{ uploadUrl: string; publicUrl: string; storageKey: string } | { error: string }> {
  const id = await userId()
  if (id === "break-glass") {
    return {
      error:
        "The break-glass account has no profile — it exists to fix the database, not to have a face.",
    }
  }

  const config = storageConfig()
  if (!config) {
    return {
      error:
        "Photo storage is not configured yet (S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY). Until it is, everyone gets initials.",
    }
  }

  const storageKey = avatarKey(id, input.filename, uploadToken())
  return {
    uploadUrl: presignPut({ config, key: storageKey }),
    publicUrl: publicUrl(config, storageKey),
    storageKey,
  }
}

export async function recordAvatarAction(input: {
  url: string
  storageKey: string
}): Promise<void> {
  const id = await userId()
  if (id === "break-glass") return

  await setAvatar(id, input.url, input.storageKey)
  revalidatePath("/", "layout")
}

export async function removeAvatarAction(): Promise<void> {
  const id = await userId()
  if (id === "break-glass") return

  await setAvatar(id, null, null)
  revalidatePath("/", "layout")
}
