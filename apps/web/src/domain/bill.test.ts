import { describe, expect, it } from "vitest"
import { type BillInput, billSummary, buildBill, tollNotice } from "./bill.ts"

const base: BillInput = {
  quotedTotalPaise: 1_596_000,
  gstTreatment: "passenger_transport_5",
  intraState: true,
  tollIncluded: false,
  parkingIncluded: false,
  statePermitIncluded: false,
  expenses: [],
  paymentsPaise: 0,
}

describe("buildBill", () => {
  it("is exactly the quote when nothing was added", () => {
    const bill = buildBill(base)

    expect(bill.totalPaise).toBe(1_596_000)
    expect(bill.asQuoted).toBe(true)
    expect(bill.addedPaise).toBe(0)
    expect(billSummary(bill)).toContain("exactly as quoted")
  })

  it("adds tolls the quote excluded, with tax on top", () => {
    const bill = buildBill({
      ...base,
      expenses: [{ kind: "toll", amountPaise: 30_000 }],
    })

    expect(bill.addedPaise).toBe(30_000)
    expect(bill.taxPaise).toBe(1_500)
    expect(bill.totalPaise).toBe(1_596_000 + 31_500)
    expect(bill.asQuoted).toBe(false)
  })

  it("charges nothing for tolls the quote included, and says so", () => {
    const bill = buildBill({
      ...base,
      tollIncluded: true,
      expenses: [{ kind: "toll", amountPaise: 30_000 }],
    })

    const line = bill.lines.find((entry) => entry.label === "Tolls on the route")
    expect(line?.amountPaise).toBe(0)
    expect(line?.detail).toContain("included")
    expect(bill.totalPaise).toBe(1_596_000)
  })

  it("sums several receipts of the same kind into one line", () => {
    // Three toll booths is one line to a customer and three receipts to the
    // operator.
    const bill = buildBill({
      ...base,
      expenses: [
        { kind: "toll", amountPaise: 12_000 },
        { kind: "toll", amountPaise: 8_000 },
        { kind: "toll", amountPaise: 10_000 },
      ],
    })

    const tolls = bill.lines.filter((entry) => entry.label === "Tolls on the route")
    expect(tolls).toHaveLength(1)
    expect(tolls[0]?.amountPaise).toBe(30_000)
  })

  it("never bills fuel, whatever the quote said", () => {
    const bill = buildBill({ ...base, expenses: [{ kind: "fuel", amountPaise: 250_000 }] })

    expect(bill.addedPaise).toBe(0)
    expect(bill.totalPaise).toBe(1_596_000)
  })

  it("marks every charge that was not in the quote", () => {
    const bill = buildBill({
      ...base,
      expenses: [
        { kind: "toll", amountPaise: 30_000 },
        { kind: "state_permit", amountPaise: 500_000 },
      ],
    })

    const added = bill.lines.filter((entry) => entry.addedAfterQuote)
    expect(added.map((entry) => entry.label).sort()).toEqual([
      "Interstate permit tax",
      "Tolls on the route",
    ])
  })

  it("tracks what is still owed", () => {
    const bill = buildBill({
      ...base,
      expenses: [{ kind: "toll", amountPaise: 30_000 }],
      paymentsPaise: 399_000,
    })

    expect(bill.paidPaise).toBe(399_000)
    expect(bill.duePaise).toBe(bill.totalPaise - 399_000)
  })

  it("reconciles: quoted plus added plus tax equals the total", () => {
    for (const expenses of [
      [],
      [{ kind: "toll" as const, amountPaise: 1 }],
      [
        { kind: "toll" as const, amountPaise: 33_333 },
        { kind: "parking" as const, amountPaise: 15_000 },
      ],
    ]) {
      const bill = buildBill({ ...base, expenses })
      expect(bill.quotedTotalPaise + bill.addedPaise + bill.taxPaise).toBe(bill.totalPaise)
    }
  })
})

describe("tollNotice", () => {
  it("promises the same thing in both directions", () => {
    expect(tollNotice(true)).toContain("included")
    expect(tollNotice(false)).toContain("added to your final bill")
    expect(tollNotice(false)).toContain("itemised")
  })
})
