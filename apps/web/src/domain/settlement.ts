import { applyBps } from "./money.ts"

/**
 * What the operator is actually paid — §7.4 and §8.3.
 *
 * Four deductions and two adjustments, and the two adjustments are the ones
 * that make this real rather than a spreadsheet formula:
 *
 * - **Expenses** the driver paid out of pocket (toll, parking, state permit)
 *   are reimbursed when the quote excluded them, so the operator is not
 *   financing the customer's tolls for a fortnight.
 * - **Cash collected by the driver** is money the operator already holds, so
 *   it comes *off* the transfer. §8.1 is blunt that half the first year's
 *   balance payments will be cash; a settlement engine that ignores that pays
 *   every operator twice.
 *
 * TCS (s.52 CGST, 1%) and TDS (s.194-O, 1%) are statutory and computed on the
 * gross consideration for the supply, not on the commission.
 */

export type SettlementInput = {
  /** Trip value as booked, inclusive of GST — the consideration for the supply. */
  grossPaise: number
  commissionBps: number
  tcsBps: number
  tdsBps: number
  /** Trip expenses the operator or driver paid that the quote did not include. */
  expensesReimbursedPaise: number
  /** Balance the driver took in cash from the customer. */
  cashCollectedPaise: number
}

export type SettlementBreakdown = {
  grossPaise: number
  commissionPaise: number
  tcsPaise: number
  tdsPaise: number
  expensesReimbursedPaise: number
  cashCollectedPaise: number
  netPayablePaise: number
  /** Negative net means the operator owes Toli — real, and worth naming. */
  operatorOwesPlatform: boolean
  lines: { label: string; amountPaise: number; note?: string }[]
}

export function computeSettlement(input: SettlementInput): SettlementBreakdown {
  const commissionPaise = applyBps(input.grossPaise, input.commissionBps)
  const tcsPaise = applyBps(input.grossPaise, input.tcsBps)
  const tdsPaise = applyBps(input.grossPaise, input.tdsBps)

  const netPayablePaise =
    input.grossPaise -
    commissionPaise -
    tcsPaise -
    tdsPaise +
    input.expensesReimbursedPaise -
    input.cashCollectedPaise

  return {
    grossPaise: input.grossPaise,
    commissionPaise,
    tcsPaise,
    tdsPaise,
    expensesReimbursedPaise: input.expensesReimbursedPaise,
    cashCollectedPaise: input.cashCollectedPaise,
    netPayablePaise,
    operatorOwesPlatform: netPayablePaise < 0,
    lines: [
      { label: "Trip value", amountPaise: input.grossPaise },
      { label: "Toli commission", amountPaise: -commissionPaise, note: "§7.4" },
      { label: "TCS", amountPaise: -tcsPaise, note: "s.52 CGST, deposited by Toli" },
      { label: "TDS", amountPaise: -tdsPaise, note: "s.194-O, certificate issued" },
      {
        label: "Expenses reimbursed",
        amountPaise: input.expensesReimbursedPaise,
        note: "toll, parking, permit paid on the road",
      },
      {
        label: "Cash collected by driver",
        amountPaise: -input.cashCollectedPaise,
        note: "already with the operator",
      },
    ].filter((line) => line.amountPaise !== 0),
  }
}

/**
 * §8.2: funds sit in the gateway's nodal account until release. Release is
 * trip completion plus a 24-hour dispute window — or immediately for a Gold
 * operator, which is the settlement-speed carrot §10 uses against
 * disintermediation.
 */
export const DISPUTE_WINDOW_HOURS = 24

export function releaseDueAt(completedAt: Date, tier: "bronze" | "silver" | "gold"): Date {
  if (tier === "gold") return completedAt
  const hours = tier === "silver" ? DISPUTE_WINDOW_HOURS / 2 : DISPUTE_WINDOW_HOURS
  return new Date(completedAt.getTime() + hours * 3600_000)
}

/**
 * §4.1's cancellation policy, tiered by days to departure — and capped.
 *
 * MVAG 2025 caps a cancellation fee at ₹100 where the cancellation lacks a
 * valid reason, but that cap addresses ride-hailing; a charter cancelled two
 * days before a wedding has cost the operator a vehicle-week it cannot resell.
 * Both numbers are returned so the ops desk sees the tension rather than
 * discovering it in a complaint.
 */
export const MVAG_CANCELLATION_FEE_CAP_PAISE = 10_000

export type CancellationOutcome = {
  daysToDeparture: number
  chargeBps: number
  chargePaise: number
  refundPaise: number
  note: string
}

export function cancellationCharge(input: {
  agreedTotalPaise: number
  departureAt: Date
  cancelledAt: Date
}): CancellationOutcome {
  const days = Math.floor((input.departureAt.getTime() - input.cancelledAt.getTime()) / 86_400_000)

  const chargeBps = days >= 7 ? 0 : days >= 3 ? 1000 : days >= 1 ? 2500 : 5000

  const chargePaise = applyBps(input.agreedTotalPaise, chargeBps)

  return {
    daysToDeparture: days,
    chargeBps,
    chargePaise,
    refundPaise: input.agreedTotalPaise - chargePaise,
    note:
      chargeBps === 0
        ? "Free cancellation — 7 or more days before departure"
        : `${chargeBps / 100}% of trip value; MVAG 2025 caps a no-reason cancellation fee at ₹100, which needs counsel's view for charter (§8.4)`,
  }
}
