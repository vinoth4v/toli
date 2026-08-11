"use server"

import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { z } from "zod"
import { signIn } from "@/auth"
import { RegistrationError, registerCustomer, registerOperator } from "@/data/register"
import { recordEvent } from "@/db/events"

/**
 * Registration submits, one per self-serve role.
 *
 * Both end in `signIn` rather than a "now go sign in" page: somebody who just
 * typed a password twice should land inside the app, not at a login form
 * asking for the thing they typed ten seconds ago. `signIn` throws
 * NEXT_REDIRECT on success, so it must be the last thing that happens.
 */

/** An Indian mobile: optional +91/0 prefix, then ten digits starting 6–9. */
function parsePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits
  const trimmed = national.length === 11 && national.startsWith("0") ? national.slice(1) : national
  return /^[6-9]\d{9}$/.test(trimmed) ? `+91 ${trimmed}` : null
}

const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  city: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(200),
})

const operatorSchema = customerSchema.extend({
  businessName: z.string().trim().min(2).max(160),
})

function back(as: "customer" | "operator", error: string): never {
  redirect(`/register?as=${as}&error=${error}`)
}

async function signInFresh(email: string, password: string): Promise<void> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/" })
  } catch (error) {
    // The account exists — a sign-in failure here is transient, and the login
    // page is the right place to retry, not the registration form.
    if (error instanceof AuthError) redirect("/login")
    throw error
  }
}

export async function registerCustomerAction(formData: FormData): Promise<void> {
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    city: formData.get("city"),
    password: formData.get("password"),
  })
  const phone = parsePhone(String(formData.get("phone") ?? ""))

  if (!phone) back("customer", "phone_invalid")
  if (!parsed.success) back("customer", "invalid")

  let email: string
  try {
    const created = await registerCustomer({ ...parsed.data, phone })
    email = created.email
  } catch (error) {
    if (error instanceof RegistrationError) back("customer", error.code)
    throw error
  }

  await recordEvent("customer_registered", email)
  await signInFresh(email, parsed.data.password)
}

export async function registerOperatorAction(formData: FormData): Promise<void> {
  const parsed = operatorSchema.safeParse({
    businessName: formData.get("businessName"),
    name: formData.get("name"),
    email: formData.get("email"),
    city: formData.get("city"),
    password: formData.get("password"),
  })
  const phone = parsePhone(String(formData.get("phone") ?? ""))

  if (!phone) back("operator", "phone_invalid")
  if (!parsed.success) back("operator", "invalid")

  let email: string
  try {
    const created = await registerOperator({
      businessName: parsed.data.businessName,
      contactName: parsed.data.name,
      city: parsed.data.city,
      phone,
      email: parsed.data.email,
      password: parsed.data.password,
    })
    email = created.email
  } catch (error) {
    if (error instanceof RegistrationError) back("operator", error.code)
    throw error
  }

  await recordEvent("operator_registered", email)
  await signInFresh(email, parsed.data.password)
}
