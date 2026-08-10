import { db } from "@/db/client"
import { auditLog } from "@/db/schema"

/**
 * What is worth being able to reconstruct later.
 *
 * The money and status events are here for one reason: when a customer says
 * they were quoted something else, or an operator says they were never told
 * about a cancellation, this table is the only record of who did what and
 * when. Everything else in the app is current state, which cannot answer that.
 */
export type AuditKind =
  | "sign_in"
  | "sign_in_failed"
  | "enquiry_created"
  | "quote_created"
  | "quote_sent"
  | "quote_accepted"
  | "quote_declined"
  | "booking_status_changed"
  | "booking_updated"
  | "payment_recorded"
  | "operator_created"
  | "operator_status_changed"
  | "vehicle_created"

/**
 * Write an audit row, swallowing failures.
 *
 * Auditing is observability, not correctness: an unreachable database must
 * never be able to lock the only operator out of their own app.
 */
export async function recordEvent(
  kind: AuditKind,
  actor: string | null,
  detail?: string,
): Promise<void> {
  try {
    await db()
      .insert(auditLog)
      .values({ kind, actor, detail: detail ?? null })
  } catch (error) {
    console.error(`audit_log write failed for "${kind}"`, error)
  }
}
