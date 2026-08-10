import { describe, expect, it } from "vitest"
import { cancellationCharge, computeSettlement, releaseDueAt } from "./settlement.ts"

const booking = {
  grossPaise: 2_982_000,
  commissionBps: 1000,
  tcsBps: 100,
  tdsBps: 100,
  expensesReimbursedPaise: 0,
  cashCollectedPaise: 0,
}

describe("computeSettlement", () => {
  it("deducts commission and both statutory levies from the gross", () => {
    const settlement = computeSettlement(booking)

    expect(settlement.commissionPaise).toBe(298_200)
    expect(settlement.tcsPaise).toBe(29_820)
    expect(settlement.tdsPaise).toBe(29_820)
    expect(settlement.netPayablePaise).toBe(2_982_000 - 298_200 - 29_820 - 29_820)
  })

  it("reimburses road expenses the quote did not include", () => {
    const settlement = computeSettlement({ ...booking, expensesReimbursedPaise: 120_000 })

    expect(settlement.netPayablePaise).toBe(2_982_000 - 298_200 - 29_820 - 29_820 + 120_000)
  })

  it("subtracts what the driver already took in cash", () => {
    // Half the first year's balances are cash (§8.1). Ignoring this pays twice.
    const settlement = computeSettlement({ ...booking, cashCollectedPaise: 2_000_000 })

    expect(settlement.netPayablePaise).toBe(2_982_000 - 298_200 - 29_820 - 29_820 - 2_000_000)
  })

  it("says plainly when the operator owes Toli rather than the other way round", () => {
    const settlement = computeSettlement({ ...booking, cashCollectedPaise: 2_982_000 })

    expect(settlement.netPayablePaise).toBeLessThan(0)
    expect(settlement.operatorOwesPlatform).toBe(true)
  })

  it("reconciles: every line adds up to the net", () => {
    const settlement = computeSettlement({
      ...booking,
      expensesReimbursedPaise: 45_500,
      cashCollectedPaise: 1_500_000,
    })
    const sum = settlement.lines.reduce((total, line) => total + line.amountPaise, 0)

    expect(sum).toBe(settlement.netPayablePaise)
  })
})

describe("releaseDueAt", () => {
  const completed = new Date("2026-08-10T10:00:00Z")

  it("holds a bronze operator's money for the full dispute window", () => {
    expect(releaseDueAt(completed, "bronze").toISOString()).toBe("2026-08-11T10:00:00.000Z")
  })

  it("releases a gold operator immediately — the anti-leakage carrot of §10", () => {
    expect(releaseDueAt(completed, "gold").getTime()).toBe(completed.getTime())
  })
})

describe("cancellationCharge", () => {
  const departure = new Date("2026-12-01T04:30:00Z")
  const total = 2_982_000

  it("is free a week out", () => {
    const outcome = cancellationCharge({
      agreedTotalPaise: total,
      departureAt: departure,
      cancelledAt: new Date("2026-11-20T04:30:00Z"),
    })

    expect(outcome.chargePaise).toBe(0)
    expect(outcome.refundPaise).toBe(total)
  })

  it("steepens as departure approaches", () => {
    const rates = [
      ["2026-11-27T04:30:00Z", 1000],
      ["2026-11-29T04:30:00Z", 2500],
      ["2026-12-01T00:30:00Z", 5000],
    ] as const

    for (const [cancelledAt, expected] of rates) {
      const outcome = cancellationCharge({
        agreedTotalPaise: total,
        departureAt: departure,
        cancelledAt: new Date(cancelledAt),
      })
      expect(outcome.chargeBps, cancelledAt).toBe(expected)
    }
  })

  it("always refunds exactly what it did not charge", () => {
    const outcome = cancellationCharge({
      agreedTotalPaise: total,
      departureAt: departure,
      cancelledAt: new Date("2026-11-29T04:30:00Z"),
    })

    expect(outcome.chargePaise + outcome.refundPaise).toBe(total)
  })

  it("flags the MVAG cap rather than silently applying or ignoring it", () => {
    const outcome = cancellationCharge({
      agreedTotalPaise: total,
      departureAt: departure,
      cancelledAt: new Date("2026-11-30T04:30:00Z"),
    })

    expect(outcome.note).toContain("MVAG")
  })
})
