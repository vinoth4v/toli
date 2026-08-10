"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import {
  addExpense,
  addPing,
  addReview,
  addTripEvent,
  assignVehicle,
  buildSettlement,
  cancelBooking,
  issueInvoice,
  markSettlementPaid,
  openDispute,
  recordPayment,
  releaseSettlement,
  resolveDispute,
} from "@/data/fulfilment"
import { recordEvent } from "@/db/events"
import { parseRupeesToPaise } from "@/domain/money"

/**
 * The booking desk: money in, vehicle out, trip run, money settled.
 *
 * Each action does one thing and revalidates the booking page. Nothing here
 * silently fixes a bad input — an assignment that fails compliance comes back
 * as a sentence explaining which document, because the fix is a phone call to
 * the operator, not a retry.
 */

async function actor(): Promise<string | null> {
  const session = await auth()
  return session?.user?.email ?? null
}

function refresh(bookingId: string): void {
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath("/bookings")
  revalidatePath("/")
}

const paymentSchema = z.object({
  bookingId: z.string().uuid(),
  kind: z.enum(["advance", "balance", "refund"]),
  mode: z.enum(["upi", "card", "netbanking", "neft", "cash_to_driver"]),
  amount: z.string().min(1),
  gatewayRef: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
})

export async function recordPaymentAction(formData: FormData): Promise<void> {
  const parsed = paymentSchema.safeParse({
    bookingId: formData.get("bookingId"),
    kind: formData.get("kind"),
    mode: formData.get("mode"),
    amount: formData.get("amount") ?? "",
    gatewayRef: formData.get("gatewayRef") ?? "",
  })

  if (!parsed.success) return

  let amountPaise: number
  try {
    amountPaise = parseRupeesToPaise(parsed.data.amount)
  } catch {
    redirect(
      `/bookings/${parsed.data.bookingId}?error=${encodeURIComponent("Amount must be in rupees")}`,
    )
  }

  await recordPayment({
    bookingId: parsed.data.bookingId,
    kind: parsed.data.kind,
    mode: parsed.data.mode,
    amountPaise,
    gatewayRef: parsed.data.gatewayRef,
  })

  await recordEvent(
    "payment_recorded",
    await actor(),
    `${parsed.data.kind} ${amountPaise} paise by ${parsed.data.mode}`,
  )
  refresh(parsed.data.bookingId)
}

export async function assignVehicleAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const vehicleId = String(formData.get("vehicleId") ?? "")
  const driverId = String(formData.get("driverId") ?? "")
  const subContractedToOperatorId = String(formData.get("subContractedToOperatorId") ?? "") || null

  if (!bookingId || !vehicleId || !driverId) return

  const outcome = await assignVehicle({
    bookingId,
    vehicleId,
    driverId,
    subContractedToOperatorId,
  })

  if (!outcome.ok) {
    // The refusal is the feature. §8.5: an operator caught without an AITP
    // faces detention, and the passengers are stranded at the border.
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent(outcome.reason)}`)
  }

  await recordEvent("vehicle_assigned", await actor(), `${vehicleId} to ${bookingId}`)
  refresh(bookingId)
}

export async function addTripEventAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const kind = String(formData.get("kind") ?? "")
  const detail = String(formData.get("detail") ?? "").trim() || null
  const odometer = String(formData.get("odometerKm") ?? "").trim()
  const lat = String(formData.get("lat") ?? "").trim() || null
  const lng = String(formData.get("lng") ?? "").trim() || null

  const kinds = ["dispatched", "started", "stop_reached", "deviation", "sos", "completed", "note"]
  if (!bookingId || !kinds.includes(kind)) return

  await addTripEvent({
    bookingId,
    kind: kind as
      | "dispatched"
      | "started"
      | "stop_reached"
      | "deviation"
      | "sos"
      | "completed"
      | "note",
    detail,
    odometerKm: odometer === "" ? null : Number(odometer),
    lat,
    lng,
  })

  await recordEvent("trip_event_added", await actor(), `${kind} on ${bookingId}`)
  refresh(bookingId)
}

export async function addExpenseAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const kind = String(formData.get("kind") ?? "")
  const amount = String(formData.get("amount") ?? "")

  const kinds = ["toll", "parking", "fuel", "state_permit"]
  if (!bookingId || !kinds.includes(kind)) return

  let amountPaise: number
  try {
    amountPaise = parseRupeesToPaise(amount)
  } catch {
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent("Amount must be in rupees")}`)
  }

  await addExpense({
    bookingId,
    kind: kind as "toll" | "parking" | "fuel" | "state_permit",
    amountPaise,
    receiptUrl: String(formData.get("receiptUrl") ?? "").trim() || null,
  })

  await recordEvent("expense_added", await actor(), `${kind} on ${bookingId}`)
  refresh(bookingId)
}

/**
 * A position, by hand.
 *
 * The driver app and the AIS-140 VLTD feed will both write here; until they
 * exist, the ops desk can drop the position a driver read out over the phone,
 * which is exactly how a tracking link gets kept alive during Phase 0.
 */
export async function addPingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const lat = String(formData.get("lat") ?? "").trim()
  const lng = String(formData.get("lng") ?? "").trim()
  if (!bookingId || !lat || !lng) return

  const speed = String(formData.get("speedKmph") ?? "").trim()

  await addPing({
    bookingId,
    lat,
    lng,
    speedKmph: speed === "" ? null : Number(speed),
    source: String(formData.get("source") ?? "ops_desk"),
  })

  refresh(bookingId)
}

export async function issueInvoiceAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  if (!bookingId) return

  const invoice = await issueInvoice(bookingId)
  await recordEvent("invoice_issued", await actor(), invoice.number)
  refresh(bookingId)
}

export async function buildSettlementAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  if (!bookingId) return

  const settlement = await buildSettlement(bookingId)
  await recordEvent("settlement_built", await actor(), `${settlement.netPayablePaise} paise net`)
  refresh(bookingId)
}

export async function releaseSettlementAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  if (!bookingId) return

  await releaseSettlement(bookingId)
  await recordEvent("settlement_released", await actor(), bookingId)
  refresh(bookingId)
}

export async function markSettlementPaidAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const utr = String(formData.get("utr") ?? "").trim()
  if (!bookingId || !utr) return

  await markSettlementPaid(bookingId, utr)
  await recordEvent("settlement_paid", await actor(), `${bookingId} UTR ${utr}`)
  refresh(bookingId)
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const reason = String(formData.get("reason") ?? "").trim()
  if (!bookingId || !reason) return

  await cancelBooking(bookingId, reason)
  await recordEvent("booking_cancelled", await actor(), `${bookingId}: ${reason}`)
  refresh(bookingId)
}

export async function addReviewAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  if (!bookingId) return

  const score = (name: string) => {
    const value = Number(formData.get(name) ?? 0)
    return Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(value))) : 3
  }

  await addReview({
    bookingId,
    cleanliness: score("cleanliness"),
    driverBehaviour: score("driverBehaviour"),
    punctuality: score("punctuality"),
    matchedBooking: score("matchedBooking"),
    comment: String(formData.get("comment") ?? "").trim() || null,
  })

  await recordEvent("review_recorded", await actor(), bookingId)
  refresh(bookingId)
}

export async function openDisputeAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const kind = String(formData.get("kind") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  if (!bookingId || !kind || !description) return

  await openDispute({ bookingId, kind, description })
  await recordEvent("dispute_opened", await actor(), `${kind} on ${bookingId}`)
  refresh(bookingId)
}

export async function resolveDisputeAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "")
  const id = String(formData.get("disputeId") ?? "")
  const status = String(formData.get("status") ?? "")
  const resolution = String(formData.get("resolution") ?? "").trim()
  if (!id || (status !== "resolved" && status !== "rejected" && status !== "investigating")) return

  let refundPaise = 0
  try {
    refundPaise = parseRupeesToPaise(String(formData.get("refund") ?? ""))
  } catch {
    redirect(`/bookings/${bookingId}?error=${encodeURIComponent("Refund must be in rupees")}`)
  }

  await resolveDispute({ id, status, resolution, refundPaise })
  await recordEvent("dispute_resolved", await actor(), `${id} → ${status}`)
  refresh(bookingId)
}
