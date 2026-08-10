import { desc, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { notification } from "@/db/schema"
import { isConfigured, NotConfiguredError } from "@/integrations/config"
import { type Message, send } from "@/integrations/whatsapp"

/**
 * The outbox.
 *
 * A message is a row before it is an API call, always — including when
 * WhatsApp is not configured, which is the state this app is in until somebody
 * opens a Business account. That is the useful part: with no credentials the
 * message still queues, the ops desk can see exactly what should have gone to
 * whom, and send it by hand from their own phone. When credentials arrive, the
 * same queue drains automatically and nothing else changes.
 *
 * A send that fails is a `failed` row with the provider's reason on it, not an
 * exception thrown at whoever happened to click the button — the booking is
 * confirmed either way, and a notification is not worth failing a booking over.
 */

export type QueueResult = { id: string; status: "sent" | "queued" | "failed"; detail: string }

export async function queueAndSend(
  message: Message,
  bookingId: string | null,
): Promise<QueueResult> {
  const rows = await db()
    .insert(notification)
    .values({
      bookingId,
      channel: "whatsapp",
      template: message.template,
      toPhone: message.toPhone,
      payload: JSON.stringify(message.variables),
      status: "queued",
    })
    .returning()

  const row = rows[0]
  if (!row) throw new Error("notification could not be queued")

  if (!isConfigured("whatsapp")) {
    return {
      id: row.id,
      status: "queued",
      detail: "WhatsApp is not configured — queued for someone to send by hand",
    }
  }

  try {
    const result = await send(message)
    await db()
      .update(notification)
      .set({
        status: "sent",
        provider: "whatsapp_cloud",
        providerRef: result.providerRef,
        sentAt: new Date(),
      })
      .where(eq(notification.id, row.id))

    return { id: row.id, status: "sent", detail: result.providerRef }
  } catch (error) {
    const detail =
      error instanceof NotConfiguredError
        ? error.message
        : error instanceof Error
          ? error.message
          : "unknown error"

    await db()
      .update(notification)
      .set({ status: "failed", error: detail.slice(0, 1000) })
      .where(eq(notification.id, row.id))

    return { id: row.id, status: "failed", detail }
  }
}

export async function listNotifications(bookingId: string) {
  return db()
    .select()
    .from(notification)
    .where(eq(notification.bookingId, bookingId))
    .orderBy(desc(notification.createdAt))
}

/** Everything still waiting, for the outbox screen. */
export async function pendingNotifications(limit = 100) {
  return db().select().from(notification).orderBy(desc(notification.createdAt)).limit(limit)
}

export async function markSentByHand(id: string): Promise<void> {
  await db()
    .update(notification)
    .set({ status: "sent", provider: "manual", sentAt: new Date() })
    .where(eq(notification.id, id))
}
