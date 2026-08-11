import { createHmac, timingSafeEqual } from "node:crypto"
import { razorpayConfig } from "./config.ts"

/**
 * Razorpay, over `fetch`.
 *
 * No SDK: this is three endpoints and an HMAC, and the blessed-dependency list
 * exists so that a fresh install never breaks. §8.1 names Razorpay and Cashfree
 * as the two candidates, so nothing outside this file knows which one is in
 * use — the payment row records a `provider` string, and a second adapter can
 * sit beside this one without touching the booking flow.
 *
 * Amounts are already integer paise everywhere in this app, which is also what
 * Razorpay's API wants. That is not a coincidence; it is why §9 chose paise.
 */

const PROVIDER = "razorpay"

export { PROVIDER as RAZORPAY_PROVIDER }

function authHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`
}

async function call<T>(path: string, init: RequestInit & { body?: string }): Promise<T> {
  const config = razorpayConfig()

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(config.keyId, config.keySecret),
      "Content-Type": "application/json",
      ...init.headers,
    },
  })

  const text = await response.text()
  if (!response.ok) {
    // Razorpay puts the useful part in error.description; the status alone
    // sends you to the wrong place ("400" could be anything).
    let detail = text.slice(0, 400)
    try {
      const parsed = JSON.parse(text) as { error?: { description?: string; code?: string } }
      if (parsed.error?.description)
        detail = `${parsed.error.code ?? ""} ${parsed.error.description}`
    } catch {
      // Not JSON. The raw body is still the best clue available.
    }
    throw new Error(`Razorpay ${response.status}: ${detail}`)
  }

  return JSON.parse(text) as T
}

export type PaymentLink = {
  id: string
  shortUrl: string
  amountPaise: number
  status: string
}

/**
 * Creates a payment link for an amount owed on a booking.
 *
 * A link rather than a hosted checkout because of how this business actually
 * takes money: the ops desk is on the phone to someone who will pay by UPI
 * from their own phone, and a link that arrives on WhatsApp is the shortest
 * path from "yes" to captured. §8.1 puts UPI intent at 70%+ of transactions.
 */
export async function createPaymentLink(input: {
  amountPaise: number
  description: string
  reference: string
  customer: { name: string; phoneE164: string; email: string | null }
  notes?: Record<string, string>
}): Promise<PaymentLink> {
  const body = JSON.stringify({
    amount: input.amountPaise,
    currency: "INR",
    accept_partial: false,
    description: input.description.slice(0, 2048),
    reference_id: input.reference,
    customer: {
      name: input.customer.name,
      contact: `+${input.customer.phoneE164}`,
      ...(input.customer.email ? { email: input.customer.email } : {}),
    },
    notify: { sms: true, email: Boolean(input.customer.email) },
    reminder_enable: true,
    notes: input.notes ?? {},
  })

  const created = await call<{
    id: string
    short_url: string
    amount: number
    status: string
  }>("/payment_links", { method: "POST", body })

  return {
    id: created.id,
    shortUrl: created.short_url,
    amountPaise: created.amount,
    status: created.status,
  }
}

export async function fetchPayment(paymentId: string): Promise<{
  id: string
  status: string
  amountPaise: number
  method: string | null
}> {
  const payment = await call<{
    id: string
    status: string
    amount: number
    method?: string
  }>(`/payments/${encodeURIComponent(paymentId)}`, { method: "GET" })

  return {
    id: payment.id,
    status: payment.status,
    amountPaise: payment.amount,
    method: payment.method ?? null,
  }
}

/* ---------------------------------------------------------------- webhooks */

/**
 * Verifies a webhook's HMAC-SHA256 signature.
 *
 * This is the security boundary of the whole payment path: without it, anyone
 * who learns a booking reference can POST "payment captured" and mark a
 * ₹40,000 trip paid. Compared in constant time, because a byte-by-byte compare
 * leaks how much of a forged signature was right.
 *
 * Pure, and therefore tested — the one part of this integration that can be
 * proven correct without a merchant account.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const given = signature.trim().toLowerCase()

  // timingSafeEqual throws on a length mismatch, which is itself a mismatch.
  if (expected.length !== given.length) return false

  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(given, "utf8"))
}

export function webhookSecret(): string {
  return razorpayConfig().webhookSecret
}

/**
 * The events worth acting on, mapped to what they mean here.
 *
 * Razorpay sends a great many; this app cares about money arriving, money
 * failing, and a refund completing. Anything else is stored for the record and
 * ignored, which is deliberate — an unrecognised event must not be an error,
 * or a new event type in the provider's roadmap becomes an outage here.
 */
export type PaymentOutcome =
  | { kind: "captured"; paymentId: string; amountPaise: number; reference: string | null }
  | { kind: "failed"; paymentId: string; reference: string | null; reason: string }
  | { kind: "refunded"; paymentId: string; amountPaise: number }
  | { kind: "ignored"; event: string }

type RazorpayWebhook = {
  event?: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        amount?: number
        error_description?: string
        notes?: Record<string, string>
        description?: string
      }
    }
    refund?: { entity?: { payment_id?: string; amount?: number } }
    payment_link?: { entity?: { reference_id?: string } }
  }
}

export function interpretWebhook(body: unknown): PaymentOutcome {
  // A body that is not an object at all is still a webhook that must be
  // answered 200 and forgotten. Throwing here would return 500, and a provider
  // that gets a 500 retries — forever, for a request that will never parse.
  if (typeof body !== "object" || body === null) return { kind: "ignored", event: "unparseable" }

  const hook = body as RazorpayWebhook
  const event = hook.event ?? "unknown"
  const payment = hook.payload?.payment?.entity
  const reference =
    hook.payload?.payment_link?.entity?.reference_id ?? payment?.notes?.booking_reference ?? null

  switch (event) {
    case "payment.captured":
    case "payment_link.paid":
      if (!payment?.id || typeof payment.amount !== "number") return { kind: "ignored", event }
      return {
        kind: "captured",
        paymentId: payment.id,
        amountPaise: payment.amount,
        reference,
      }

    case "payment.failed":
      if (!payment?.id) return { kind: "ignored", event }
      return {
        kind: "failed",
        paymentId: payment.id,
        reference,
        reason: payment.error_description ?? "declined",
      }

    case "refund.processed": {
      const refund = hook.payload?.refund?.entity
      if (!refund?.payment_id || typeof refund.amount !== "number") {
        return { kind: "ignored", event }
      }
      return { kind: "refunded", paymentId: refund.payment_id, amountPaise: refund.amount }
    }

    default:
      return { kind: "ignored", event }
  }
}

/**
 * A stable identifier for an event, for the idempotency index.
 *
 * Razorpay's `x-razorpay-event-id` header is the right answer when present.
 * When it is not — older webhooks, replays from the dashboard — the event name
 * plus the payment id is stable enough to stop a retry recording a payment
 * twice, which is the only thing this needs to guarantee.
 */
export function eventIdOf(headerValue: string | null, body: unknown): string {
  if (headerValue && headerValue.trim() !== "") return headerValue.trim()
  if (typeof body !== "object" || body === null) return "unparseable"

  const hook = body as RazorpayWebhook
  const paymentId =
    hook.payload?.payment?.entity?.id ?? hook.payload?.refund?.entity?.payment_id ?? "unknown"
  return `${hook.event ?? "unknown"}:${paymentId}`
}
