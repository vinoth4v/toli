import { type NextRequest, NextResponse } from "next/server"
import { markPaymentCaptured, markPaymentFailed, recordWebhook } from "@/data/payments"
import { NotConfiguredError } from "@/integrations/config"
import {
  eventIdOf,
  interpretWebhook,
  verifyWebhookSignature,
  webhookSecret,
} from "@/integrations/razorpay"

/**
 * Razorpay's webhook.
 *
 * Three rules govern everything here, and all three exist because this
 * endpoint is the only unauthenticated path that can mark money received.
 *
 * **Verify before parsing.** The signature is over the raw body, so the body
 * is read as text and checked before it is treated as JSON. An unverified
 * request is not logged as an event, it is refused.
 *
 * **Record before acting.** Every verified event is stored, and the unique
 * index on (provider, event id) is what stops a retry recording a ₹40,000
 * payment twice.
 *
 * **Answer 200 to anything understood.** A gateway that receives a 500 retries,
 * and an event this app does not care about must not be retried forever.
 */

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<NextResponse> {
  let secret: string
  try {
    secret = webhookSecret()
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      // Nothing is wired up, so nobody legitimate is calling this. Saying so
      // is better than a silent 200 that looks like it worked.
      return NextResponse.json({ error: "Payments are not configured" }, { status: 503 })
    }
    throw error
  }

  const raw = await request.text()
  const signature = request.headers.get("x-razorpay-signature") ?? ""

  if (!verifyWebhookSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 })
  }

  const body: unknown = JSON.parse(raw)
  const eventId = eventIdOf(request.headers.get("x-razorpay-event-id"), body)
  const outcome = interpretWebhook(body)

  const fresh = await recordWebhook({
    provider: "razorpay",
    providerEventId: eventId,
    kind: outcome.kind === "ignored" ? outcome.event : outcome.kind,
    payload: raw.slice(0, 20_000),
    signatureValid: true,
  })

  // Already seen. Razorpay retries on any non-2xx and sometimes on a timeout,
  // so this is the ordinary path, not an error.
  if (!fresh) return NextResponse.json({ status: "duplicate" })

  switch (outcome.kind) {
    case "captured":
      await markPaymentCaptured({
        providerPaymentId: outcome.paymentId,
        amountPaise: outcome.amountPaise,
        bookingReference: outcome.reference,
        eventId,
      })
      break

    case "failed":
      await markPaymentFailed({
        providerPaymentId: outcome.paymentId,
        bookingReference: outcome.reference,
        reason: outcome.reason,
        eventId,
      })
      break

    case "refunded":
      // A refund is money leaving, and §8.2 releases operator settlement on
      // trip completion — so a refund after settlement is a recovery the ops
      // desk has to handle, not something to net off silently here.
      await markPaymentFailed({
        providerPaymentId: outcome.paymentId,
        bookingReference: null,
        reason: `Refunded ${outcome.amountPaise} paise — check the settlement`,
        eventId,
      })
      break

    default:
      break
  }

  return NextResponse.json({ status: "ok" })
}
