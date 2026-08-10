import { describe, expect, test } from "vitest"
import { moneyPosition } from "@/db/bookings"
import type { PaymentRow } from "@/db/schema"
import type { PaymentKind } from "@/domain/status"

const quoteRow = { totalPaise: 2_000_000, operatorPayoutPaise: 1_600_000 }

function paymentRow(kind: PaymentKind, amountPaise: number): PaymentRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    bookingId: "00000000-0000-0000-0000-000000000001",
    kind,
    amountPaise,
    method: "upi",
    reference: null,
    note: null,
    at: new Date("2026-08-10T00:00:00.000Z"),
  }
}

describe("moneyPosition", () => {
  test("owes the whole fare before anything is collected", () => {
    const position = moneyPosition(quoteRow, [])

    expect(position.collectedPaise).toBe(0)
    expect(position.dueFromCustomerPaise).toBe(2_000_000)
    expect(position.dueToOperatorPaise).toBe(1_600_000)
  })

  test("counts an advance against what the customer still owes", () => {
    const position = moneyPosition(quoteRow, [paymentRow("customer_advance", 500_000)])

    expect(position.collectedPaise).toBe(500_000)
    expect(position.dueFromCustomerPaise).toBe(1_500_000)
  })

  test("settles to zero once the fare is in and the operator is paid", () => {
    const position = moneyPosition(quoteRow, [
      paymentRow("customer_advance", 500_000),
      paymentRow("customer_balance", 1_500_000),
      paymentRow("operator_payout", 1_600_000),
    ])

    expect(position.dueFromCustomerPaise).toBe(0)
    expect(position.dueToOperatorPaise).toBe(0)
  })

  test("treats a refund as money given back, not as an operator payout", () => {
    const position = moneyPosition(quoteRow, [
      paymentRow("customer_advance", 500_000),
      paymentRow("refund", 200_000),
    ])

    expect(position.collectedPaise).toBe(300_000)
    expect(position.paidOutPaise).toBe(0)
    expect(position.dueToOperatorPaise).toBe(1_600_000)
  })

  test("never reports a negative amount owing when more was collected than due", () => {
    const position = moneyPosition(quoteRow, [paymentRow("customer_advance", 2_500_000)])

    expect(position.dueFromCustomerPaise).toBe(0)
  })
})
