import { desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import { enquiry, type EnquiryRow } from "@/db/schema"
import type { EnquiryStatus } from "@/domain/status"

/** Enquiries still worth working: everything that is neither won nor dead. */
export const OPEN_ENQUIRY_STATUSES: readonly EnquiryStatus[] = ["new", "quoted"]

export async function listEnquiries(statuses?: readonly EnquiryStatus[]): Promise<EnquiryRow[]> {
  const query = db().select().from(enquiry)
  const rows = statuses
    ? await query.where(inArray(enquiry.status, [...statuses])).orderBy(desc(enquiry.createdAt))
    : await query.orderBy(desc(enquiry.createdAt))
  return rows
}

export async function getEnquiry(id: string): Promise<EnquiryRow | undefined> {
  const rows = await db().select().from(enquiry).where(eq(enquiry.id, id)).limit(1)
  return rows[0]
}

export async function createEnquiry(
  values: typeof enquiry.$inferInsert,
): Promise<EnquiryRow | undefined> {
  const rows = await db().insert(enquiry).values(values).returning()
  return rows[0]
}

export async function setEnquiryStatus(id: string, status: EnquiryStatus): Promise<void> {
  await db().update(enquiry).set({ status }).where(eq(enquiry.id, id))
}
