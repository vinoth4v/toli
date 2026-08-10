import { db } from "@/db/client"
import { auditLog } from "@/db/schema"

export type AuditKind =
  | "sign_in"
  | "sign_in_failed"
  // The marketplace's own events. Money and supply move through these four,
  // and the desk has no other history: a quote awarded to the wrong operator
  // is only ever recoverable from here.
  | "operator_added"
  | "operator_verified"
  | "request_created"
  | "request_cancelled"
  | "quote_recorded"
  | "quote_awarded"
  | "booking_updated"

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
