import { computeGst, type GstTreatmentKey } from "./gst.ts"
import { formatPaise } from "./money.ts"

/**
 * The bill a customer actually sees.
 *
 * This is the counterpart to the quote: a quote is a promise, a bill is what
 * happened. The difference between them is the entire reputation of this
 * market — the ₹28,000 that becomes ₹41,000 — so the bill is built to show
 * that difference explicitly rather than to hide it in a total.
 *
 * Tolls are the clearest case and get their own treatment. When a quote said
 * tolls were included, they do not appear again; when it said excluded, every
 * toll the driver paid is listed with what it was for, and the bill says
 * plainly that these are added. Nobody should discover a toll charge for the
 * first time on a total.
 */

export type BillLine = {
  label: string
  amountPaise: number
  /** Shown under the label, in smaller type. */
  detail?: string
  /** Charges that were not in the quote are marked, so the eye finds them. */
  addedAfterQuote?: boolean
}

export type Bill = {
  lines: BillLine[]
  quotedTotalPaise: number
  addedPaise: number
  taxPaise: number
  totalPaise: number
  paidPaise: number
  duePaise: number
  /** True when nothing beyond the quote was added — worth saying out loud. */
  asQuoted: boolean
  gstRateBps: number
}

export type BillInput = {
  /** What the customer accepted, inclusive of tax. */
  quotedTotalPaise: number
  gstTreatment: GstTreatmentKey
  intraState: boolean
  /** What the quote said it covered. */
  tollIncluded: boolean
  parkingIncluded: boolean
  statePermitIncluded: boolean
  /** What the driver actually paid on the road. */
  expenses: { kind: "toll" | "parking" | "fuel" | "state_permit"; amountPaise: number }[]
  /** What the customer has already paid. */
  paymentsPaise: number
}

const EXPENSE_LABEL: Record<string, string> = {
  toll: "Tolls on the route",
  parking: "Parking",
  fuel: "Fuel",
  state_permit: "Interstate permit tax",
}

/** Which quote flag covers which expense; anything uncovered is billable. */
const COVERED_BY: Record<string, keyof BillInput> = {
  toll: "tollIncluded",
  parking: "parkingIncluded",
  state_permit: "statePermitIncluded",
}

export function buildBill(input: BillInput): Bill {
  const lines: BillLine[] = [
    {
      label: "Trip as quoted",
      amountPaise: input.quotedTotalPaise,
      detail: "the price you accepted, including GST",
    },
  ]

  // Group expenses by kind: three toll receipts are one line on a bill, not
  // three — the customer wants the number, the operator wants the receipts.
  const byKind = new Map<string, number>()
  for (const expense of input.expenses) {
    byKind.set(expense.kind, (byKind.get(expense.kind) ?? 0) + expense.amountPaise)
  }

  let addedPaise = 0

  for (const [kind, amountPaise] of byKind) {
    if (amountPaise <= 0) continue

    const coveringFlag = COVERED_BY[kind]
    const alreadyCovered = coveringFlag ? Boolean(input[coveringFlag]) : true

    if (alreadyCovered) {
      // Fuel is always the operator's, and anything the quote included stays
      // included — saying so is more reassuring than silence.
      lines.push({
        label: EXPENSE_LABEL[kind] ?? kind,
        amountPaise: 0,
        detail: "included in your quoted price",
      })
      continue
    }

    lines.push({
      label: EXPENSE_LABEL[kind] ?? kind,
      amountPaise,
      detail: "paid by the driver on your behalf",
      addedAfterQuote: true,
    })
    addedPaise += amountPaise
  }

  // Tax applies to what was added; the quoted total already carries its own.
  const gst = computeGst(addedPaise, input.gstTreatment, input.intraState)
  const totalPaise = input.quotedTotalPaise + gst.totalPaise

  if (addedPaise > 0) {
    lines.push({ label: "GST on added charges", amountPaise: gst.taxPaise })
  }

  return {
    lines,
    quotedTotalPaise: input.quotedTotalPaise,
    addedPaise,
    taxPaise: gst.taxPaise,
    totalPaise,
    paidPaise: input.paymentsPaise,
    duePaise: totalPaise - input.paymentsPaise,
    asQuoted: addedPaise === 0,
    gstRateBps: gst.rateBps,
  }
}

/**
 * The sentence that goes next to every quote and on every bill.
 *
 * Written out rather than left to each screen, so the promise is worded
 * identically wherever a customer meets it.
 */
export function tollNotice(tollIncluded: boolean): string {
  return tollIncluded
    ? "Tolls are included in this price. They will appear on your bill at ₹0, not as an extra."
    : "Tolls are not included in this price. Whatever the driver pays on the route is added to your final bill, itemised, with the receipts against it."
}

/** "₹15,960, of which ₹300 was added after the quote." */
export function billSummary(bill: Bill): string {
  if (bill.asQuoted) return `${formatPaise(bill.totalPaise)}, exactly as quoted.`
  return `${formatPaise(bill.totalPaise)}, of which ${formatPaise(
    bill.addedPaise + bill.taxPaise,
  )} was added after the quote.`
}
