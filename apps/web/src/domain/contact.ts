import { checkIndianMobile } from "./identifiers.ts"

/**
 * Reaching a human.
 *
 * Indian customers phone before they pay, and a marketplace with no visible
 * number reads as a marketplace with nobody behind it. §10 is not an argument
 * against that instinct — it is an argument about *whose* number: Toli's is
 * published everywhere, and the operator's is released once a booking exists,
 * which is exactly when the customer has a legitimate reason to call them and
 * the platform has already been paid for the introduction.
 *
 * WhatsApp gets first billing on purpose. §4.5 puts it ahead of push and SMS
 * because it is the channel Indian users actually read.
 */

/** `tel:` wants E.164 with a plus; anything unusable returns null rather than a broken link. */
export function telLink(phone: string): string | null {
  const check = checkIndianMobile(phone)
  if (check.valid) return `tel:+${check.e164}`

  // Landlines are legitimate for an office — keep the digits, drop the rest.
  const digits = phone.replace(/[^\d+]/g, "")
  return digits.length >= 8 ? `tel:${digits.startsWith("+") ? digits : `+${digits}`}` : null
}

/**
 * A wa.me link, optionally with the first message written for them.
 *
 * The prefilled text matters more than it looks: a customer who has to compose
 * "hello, about my booking" often does not, and an operator who receives
 * "TOLI-B-000002, Madurai to Kodaikanal, 12 Aug" can answer in one line.
 */
export function whatsappLink(phone: string, message?: string): string | null {
  const check = checkIndianMobile(phone)
  const digits = check.valid ? check.e164 : phone.replace(/\D/g, "")
  if (digits.length < 10) return null

  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export function mailtoLink(email: string, subject?: string): string | null {
  if (!email.includes("@")) return null
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`
}

/** What a customer's first WhatsApp message about a trip should say. */
export function bookingEnquiry(reference: string, route: string, when: string): string {
  return `Hello, about Toli booking ${reference} — ${route}, ${when}.`
}
