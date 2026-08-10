import { applyBps } from "./money.ts"

/**
 * GST, modelled both ways on purpose.
 *
 * §8.3 is the plan's one genuinely unresolved question: whether a charter is
 * "transportation of passengers" (5% without ITC, or 12% with) or "rental of
 * a motor vehicle with operator" (18%). It changes the rate, the ITC position
 * and the unit economics by seven points, and the plan's instruction is to get
 * a written opinion and *build the engine to handle both*.
 *
 * So the treatment is an attribute of a booking, chosen from a platform
 * default, and nothing in this file assumes which answer comes back. Changing
 * the default is a settings edit, not a migration.
 */

export type GstTreatmentKey =
  | "passenger_transport_5"
  | "passenger_transport_12"
  | "rental_with_operator_18"

/**
 * A treatment carries no copy of its own key: the record below is keyed by it,
 * and a field that must always equal its own map key is a second source of
 * truth waiting to drift. Callers that need the key iterate `Object.entries`.
 */
export type GstTreatment = {
  label: string
  rateBps: number
  /** Whether input tax credit is available on this treatment. */
  inputTaxCredit: boolean
  /** SAC code printed on the invoice. */
  sacCode: string
  /** The statutory hook, shown in the settings screen so the choice is auditable. */
  basis: string
}

export const GST_TREATMENTS: Record<GstTreatmentKey, GstTreatment> = {
  passenger_transport_5: {
    label: "Passenger transport — 5%, no ITC",
    rateBps: 500,
    inputTaxCredit: false,
    sacCode: "996412",
    basis: "Notification 11/2017-CT(R); ECO deemed supplier under s.9(5) CGST",
  },
  passenger_transport_12: {
    label: "Passenger transport — 12%, with ITC",
    rateBps: 1200,
    inputTaxCredit: true,
    sacCode: "996412",
    basis: "Notification 11/2017-CT(R), ITC option",
  },
  rental_with_operator_18: {
    label: "Rental of vehicle with operator — 18%",
    rateBps: 1800,
    inputTaxCredit: true,
    sacCode: "996601",
    basis: "Rental of transport vehicles with operator",
  },
}

export const GST_TREATMENT_KEYS = Object.keys(GST_TREATMENTS) as GstTreatmentKey[]

export type GstBreakup = {
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  taxPaise: number
  totalPaise: number
  rateBps: number
  sacCode: string
}

/**
 * Splits tax the way an Indian invoice must show it: CGST plus SGST when the
 * place of supply is the supplier's own state, IGST when it is not.
 *
 * The halves are computed from the total tax rather than each from the rate,
 * so CGST + SGST is exactly the tax charged even when the rupee does not
 * halve cleanly. The odd paisa goes to CGST, consistently, so two invoices for
 * the same amount never differ.
 */
export function computeGst(
  taxablePaise: number,
  treatmentKey: GstTreatmentKey,
  intraState: boolean,
): GstBreakup {
  const treatment = GST_TREATMENTS[treatmentKey]
  const taxPaise = applyBps(taxablePaise, treatment.rateBps)

  const cgstPaise = intraState ? Math.ceil(taxPaise / 2) : 0
  const sgstPaise = intraState ? taxPaise - cgstPaise : 0
  const igstPaise = intraState ? 0 : taxPaise

  return {
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    taxPaise,
    totalPaise: taxablePaise + taxPaise,
    rateBps: treatment.rateBps,
    sacCode: treatment.sacCode,
  }
}

/**
 * The reverse: a quote agreed as an all-inclusive number has tax inside it,
 * and the invoice needs the taxable value that produced it.
 *
 * Operators quote gross ("₹28,400 all-in") and customers compare gross, so
 * this direction is the common one — the taxable base is derived, not entered.
 */
export function extractGstFromGross(
  grossPaise: number,
  treatmentKey: GstTreatmentKey,
  intraState: boolean,
): GstBreakup {
  const { rateBps } = GST_TREATMENTS[treatmentKey]
  const taxablePaise = Math.round((grossPaise * 10_000) / (10_000 + rateBps))
  const taxPaise = grossPaise - taxablePaise

  const cgstPaise = intraState ? Math.ceil(taxPaise / 2) : 0
  const sgstPaise = intraState ? taxPaise - cgstPaise : 0

  return {
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise: intraState ? 0 : taxPaise,
    taxPaise,
    totalPaise: grossPaise,
    rateBps,
    sacCode: GST_TREATMENTS[treatmentKey].sacCode,
  }
}
