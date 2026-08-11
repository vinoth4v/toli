import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import { booking, payment, webhookEvent } from "@/db/schema"

/**
 * What the payment webhook writes.
 *
 * Kept apart from the route so the route stays about HTTP — signature, status
 * codes, idempotency — and this stays about what a captured payment means to a
 * booking.
 */

/**
 * Stores an event, returning false when it has been seen before.
 *
 * The unique index on (provider, event id) does the work; catching its
 * violation is how "have I already processed this" is answered without a
 * read-then-write race between two concurrent retries.
 */
export async function recordWebhook(input: {
  provider: string
  providerEventId: string
  kind: string
  payload: string
  signatureValid: boolean
}): Promise<boolean> {
  const inserted = await db()
    .insert(webhookEvent)
    .values(input)
    .onConflictDoNothing({ target: [webhookEvent.provider, webhookEvent.providerEventId] })
    .returning({ id: webhookEvent.id })

  return inserted.length > 0
}

async function markProcessed(eventId: string, error: string | null): Promise<void> {
  await db()
    .update(webhookEvent)
    .set({ processedAt: new Date(), error })
    .where(and(eq(webhookEvent.provider, "razorpay"), eq(webhookEvent.providerEventId, eventId)))
}

/**
 * Marks money received.
 *
 * The payment row is found by the provider's own payment id when it already
 * exists — a link created from the console writes one in `pending` — and by
 * booking reference otherwise, which covers a customer paying a link that was
 * sent from the gateway dashboard rather than from here.
 *
 * If neither finds a booking the event is still stored and flagged, because an
 * unattributable payment is a real thing that happens and a reconciliation
 * problem for a person, not something to guess at.
 */
export async function markPaymentCaptured(input: {
  providerPaymentId: string
  amountPaise: number
  bookingReference: string | null
  eventId: string
}): Promise<void> {
  const existing = await db()
    .select()
    .from(payment)
    .where(eq(payment.providerPaymentId, input.providerPaymentId))
    .limit(1)

  if (existing[0]) {
    await db()
      .update(payment)
      .set({ status: "captured", collectedAt: new Date(), amountPaise: input.amountPaise })
      .where(eq(payment.id, existing[0].id))

    await recordEvent("payment_recorded", "razorpay-webhook", `${input.providerPaymentId} captured`)
    await markProcessed(input.eventId, null)
    return
  }

  const target = input.bookingReference
    ? await db()
        .select()
        .from(booking)
        .where(eq(booking.reference, input.bookingReference))
        .limit(1)
    : []

  const found = target[0]
  if (!found) {
    await markProcessed(
      input.eventId,
      `Captured ${input.amountPaise} paise with no matching booking (${input.bookingReference ?? "no reference"})`,
    )
    return
  }

  // Which kind of payment this is follows from what is still owed, not from
  // anything the gateway said: the first money in on a booking is the advance.
  const paid = await db().select().from(payment).where(eq(payment.bookingId, found.id))
  const alreadyCaptured = paid
    .filter((row) => row.status === "captured" && row.kind !== "refund")
    .reduce((total, row) => total + row.amountPaise, 0)

  await db()
    .insert(payment)
    .values({
      bookingId: found.id,
      kind: alreadyCaptured === 0 ? "advance" : "balance",
      mode: "upi",
      amountPaise: input.amountPaise,
      status: "captured",
      provider: "razorpay",
      providerPaymentId: input.providerPaymentId,
      gatewayRef: input.providerPaymentId,
      collectedAt: new Date(),
    })

  await recordEvent(
    "payment_recorded",
    "razorpay-webhook",
    `${found.reference}: ${input.amountPaise} paise captured`,
  )
  await markProcessed(input.eventId, null)
}

export async function markPaymentFailed(input: {
  providerPaymentId: string
  bookingReference: string | null
  reason: string
  eventId: string
}): Promise<void> {
  const existing = await db()
    .select()
    .from(payment)
    .where(eq(payment.providerPaymentId, input.providerPaymentId))
    .limit(1)

  if (existing[0]) {
    await db().update(payment).set({ status: "failed" }).where(eq(payment.id, existing[0].id))
  }

  await recordEvent(
    "payment_recorded",
    "razorpay-webhook",
    `${input.providerPaymentId} failed: ${input.reason}`,
  )
  await markProcessed(input.eventId, input.reason)
}

/** A pending row for a link that has been sent, so the console shows it before it is paid. */
export async function recordPendingLink(input: {
  bookingId: string
  kind: "advance" | "balance"
  amountPaise: number
  providerLinkId: string
  providerLinkUrl: string
}): Promise<void> {
  await db().insert(payment).values({
    bookingId: input.bookingId,
    kind: input.kind,
    mode: "upi",
    amountPaise: input.amountPaise,
    status: "pending",
    provider: "razorpay",
    providerOrderId: input.providerLinkId,
    providerLinkUrl: input.providerLinkUrl,
  })
}

export async function recentWebhooks(limit = 20) {
  return db().select().from(webhookEvent).orderBy(webhookEvent.receivedAt).limit(limit)
}
