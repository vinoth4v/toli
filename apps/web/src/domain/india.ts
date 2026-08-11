/**
 * States, and the GST state codes that decide whether an invoice carries
 * CGST+SGST or IGST.
 *
 * The first two digits of a GSTIN are the state code, which is how a
 * corporate customer's registration reveals the place of supply without
 * anybody typing it a second time. Rajasthan is 08 — the launch city in §11
 * is Jaipur.
 *
 * Union territories are included because a charter to Chandigarh or Daman is
 * an ordinary trip from Delhi, and leaving them out would silently make those
 * invoices wrong.
 */

export type State = { code: string; name: string }

export const STATES: State[] = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
]

export const STATE_NAMES = STATES.map((state) => state.name)

export function stateCode(name: string): string | null {
  return STATES.find((state) => state.name === name)?.code ?? null
}

export function stateFromGstin(gstin: string | null): string | null {
  if (!gstin || gstin.length < 2) return null
  const code = gstin.slice(0, 2)
  return STATES.find((state) => state.code === code)?.name ?? null
}

/**
 * Whether the supply is intra-state, which is the CGST+SGST vs IGST decision.
 *
 * For passenger transport the place of supply is where the passenger embarks,
 * so the trip's origin state decides it — except for a registered customer,
 * whose registration state governs. A Mumbai company booking a Jaipur wedding
 * coach gets IGST, and getting that backwards means an invoice its accounts
 * team will reject.
 */
export function isIntraState(input: {
  supplierState: string
  originState: string
  customerGstin: string | null
}): boolean {
  const registered = stateFromGstin(input.customerGstin)
  const placeOfSupply = registered ?? input.originState
  return placeOfSupply === input.supplierState
}

export function placeOfSupply(input: {
  originState: string
  customerGstin: string | null
}): string {
  return stateFromGstin(input.customerGstin) ?? input.originState
}

/**
 * The launch corridor: **Madurai first**, then the towns vehicles already run
 * between from there.
 *
 * §11 argues for one city and a corridor rather than scattered cities, because
 * vehicles move between corridor towns and an operator signed for one route is
 * already useful on the next. Madurai is that wedge here — temple tourism,
 * Kodaikanal hill traffic, the Rameswaram and Palani pilgrimage circuits, and
 * wedding season demand, all served by the same fleets.
 *
 * The market Toli sells to is all of India; the market it *operates* in starts
 * here. Examples, seed data and copy stay in this corridor until that changes,
 * so nothing in the product quietly implies coverage that does not exist.
 */
export const LAUNCH_CITIES = [
  "Madurai",
  "Kodaikanal",
  "Rameswaram",
  "Palani",
  "Trichy",
  "Dindigul",
  "Theni",
  "Chennai",
  "Coimbatore",
] as const

/**
 * Where a vehicle from this corridor actually crosses to.
 *
 * Munnar and Thekkady are the Kerala runs; Bengaluru and Tirupati pull groups
 * north. Offering all thirty-six states here would be honest about the country
 * and useless about the fleet — an operator in Madurai does not hold a permit
 * for Assam.
 */
export const NEIGHBOURING_STATES = ["Kerala", "Karnataka", "Andhra Pradesh", "Puducherry"] as const

/** Toli's own registration state — the default place of supply. */
export const HOME_STATE = "Tamil Nadu"
