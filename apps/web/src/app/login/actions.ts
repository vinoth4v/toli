"use server"

import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { signIn } from "@/auth"

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  // Which step the attempt was made on, so a rejection returns there rather
  // than dumping the person back at "who is signing in?" to start again.
  const as = String(formData.get("as") ?? "").trim()

  try {
    // Redirect to "/" and let the front page route by role: it already
    // redirects a signed-in visitor to their own home, so there is exactly one
    // place that knows where each role belongs.
    await signIn("credentials", { email, password, redirectTo: "/" })
  } catch (error) {
    // A successful sign-in also throws — NEXT_REDIRECT — so only auth errors
    // are ours to handle. Anything else has to keep travelling.
    if (error instanceof AuthError) {
      redirect(as ? `/login?as=${encodeURIComponent(as)}&error=invalid` : "/login?error=invalid")
    }
    throw error
  }
}
