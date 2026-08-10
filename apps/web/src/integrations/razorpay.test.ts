import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { eventIdOf, interpretWebhook, verifyWebhookSignature } from "./razorpay.ts"

/**
 * The parts of the payment integration that can be proven without a merchant
 * account — which is, deliberately, every part that could lose money.
 */

const SECRET = "a-webhook-secret-only-razorpay-and-we-know"

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: {} })

  it("accepts a signature made with the shared secret", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true)
  })

  it("rejects a signature made with the wrong secret", () => {
    // Without this, anyone who learns a booking reference can mark a ₹40,000
    // trip paid by POSTing to the webhook.
    expect(verifyWebhookSignature(body, sign(body, "not-the-secret"), SECRET)).toBe(false)
  })

  it("rejects a body that was altered after signing", () => {
    const signature = sign(body)
    const tampered = JSON.stringify({ event: "payment.captured", payload: { extra: true } })

    expect(verifyWebhookSignature(tampered, signature, SECRET)).toBe(false)
  })

  it("rejects an empty, short or overlong signature rather than throwing", () => {
    // timingSafeEqual throws on a length mismatch; a webhook handler that
    // throws returns 500, and Razorpay retries a forged request forever.
    expect(verifyWebhookSignature(body, "", SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, "abc", SECRET)).toBe(false)
    expect(verifyWebhookSignature(body, `${sign(body)}00`, SECRET)).toBe(false)
  })

  it("is case- and whitespace-insensitive about the hex it is given", () => {
    expect(verifyWebhookSignature(body, ` ${sign(body).toUpperCase()} `, SECRET)).toBe(true)
  })
})

describe("interpretWebhook", () => {
  it("reads a captured payment, with the booking reference from the link", () => {
    const outcome = interpretWebhook({
      event: "payment.captured",
      payload: {
        payment: { entity: { id: "pay_ABC123", amount: 399_000 } },
        payment_link: { entity: { reference_id: "TOLI-B-000001" } },
      },
    })

    expect(outcome).toEqual({
      kind: "captured",
      paymentId: "pay_ABC123",
      amountPaise: 399_000,
      reference: "TOLI-B-000001",
    })
  })

  it("falls back to the reference in notes when there is no payment link", () => {
    const outcome = interpretWebhook({
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_XYZ", amount: 100, notes: { booking_reference: "TOLI-B-000009" } },
        },
      },
    })

    expect(outcome.kind).toBe("captured")
    if (outcome.kind === "captured") expect(outcome.reference).toBe("TOLI-B-000009")
  })

  it("reads a failure with its reason", () => {
    const outcome = interpretWebhook({
      event: "payment.failed",
      payload: {
        payment: { entity: { id: "pay_F", error_description: "insufficient funds" } },
      },
    })

    expect(outcome.kind).toBe("failed")
    if (outcome.kind === "failed") expect(outcome.reason).toBe("insufficient funds")
  })

  it("reads a processed refund against the original payment", () => {
    const outcome = interpretWebhook({
      event: "refund.processed",
      payload: { refund: { entity: { payment_id: "pay_ABC123", amount: 50_000 } } },
    })

    expect(outcome).toEqual({ kind: "refunded", paymentId: "pay_ABC123", amountPaise: 50_000 })
  })

  it("ignores an event it does not know rather than failing", () => {
    // A new event type in the provider's roadmap must not become an outage here.
    expect(interpretWebhook({ event: "order.paid", payload: {} })).toEqual({
      kind: "ignored",
      event: "order.paid",
    })
  })

  it("ignores a well-named event with a malformed body", () => {
    expect(interpretWebhook({ event: "payment.captured", payload: {} }).kind).toBe("ignored")
    expect(interpretWebhook({}).kind).toBe("ignored")
    expect(interpretWebhook(null).kind).toBe("ignored")
  })
})

describe("eventIdOf", () => {
  it("prefers the provider's own event id", () => {
    expect(eventIdOf("evt_123", { event: "payment.captured" })).toBe("evt_123")
  })

  it("derives a stable id when the header is absent, so a retry cannot double-record", () => {
    const body = { event: "payment.captured", payload: { payment: { entity: { id: "pay_A" } } } }

    expect(eventIdOf(null, body)).toBe("payment.captured:pay_A")
    expect(eventIdOf("  ", body)).toBe(eventIdOf(null, body))
  })
})
