import { desc } from "drizzle-orm"
import { db } from "@/db/client"
import { auditLog } from "@/db/schema"

/**
 * §4.4 asks for a full audit log — "every admin action attributable", because
 * regulators and auditors will ask. Sign-ins came with the template; the rest
 * are the actions that move money, change what a customer was promised, or
 * decide whether a vehicle may carry passengers.
 *
 * Reads are not logged. A log that records everything is one nobody reads, and
 * the interesting question is always who changed something.
 */
export type AuditKind =
  | "sign_in"
  | "sign_in_failed"
  | "operator_created"
  | "vehicle_created"
  | "vehicle_status_changed"
  | "document_verified"
  | "compliance_check_recorded"
  | "driver_created"
  | "request_created"
  | "operators_invited"
  | "quote_submitted"
  | "quote_accepted"
  | "payment_recorded"
  | "vehicle_assigned"
  | "trip_event_added"
  | "expense_added"
  | "invoice_issued"
  | "settlement_built"
  | "settlement_released"
  | "settlement_paid"
  | "booking_cancelled"
  | "dispute_opened"
  | "dispute_resolved"
  | "review_recorded"
  | "settings_updated"
  | "customer_registered"
  | "operator_registered"
  | "driver_login_issued"

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

export async function recentEvents(limit = 50) {
  return db().select().from(auditLog).orderBy(desc(auditLog.at)).limit(limit)
}
