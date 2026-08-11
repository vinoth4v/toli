/**
 * The vehicle taxonomy of §4.6, which the plan says to get right in the schema
 * on day one — and the lifecycle state machine of §9.
 *
 * "Tempo traveller" covers six seat counts that are not interchangeable: a
 * group of 14 in a 13-seater is an illegal trip, and in a 26-seater it is a
 * quote 40% too expensive. So seats are stored separately from class, and the
 * class carries the seat counts that actually exist in the market.
 */

export const VEHICLE_CLASSES = [
  "mpv_suv",
  "tempo_traveller",
  "mini_bus",
  "coach_seater",
  "coach_multi_axle",
  "sleeper_coach",
  "double_decker",
] as const

export type VehicleClass = (typeof VEHICLE_CLASSES)[number]

export type VehicleClassInfo = {
  key: VehicleClass
  label: string
  /** Seat counts sold in this market. Not a range — these are the real builds. */
  seatOptions: number[]
  typicalUse: string
}

export const VEHICLE_CLASS_INFO: Record<VehicleClass, VehicleClassInfo> = {
  mpv_suv: {
    key: "mpv_suv",
    label: "MPV / SUV",
    seatOptions: [6, 7],
    typicalUse: "Small family group",
  },
  tempo_traveller: {
    key: "tempo_traveller",
    label: "Tempo Traveller",
    seatOptions: [9, 12, 13, 17, 20, 26],
    typicalUse: "The workhorse of this market",
  },
  mini_bus: {
    key: "mini_bus",
    label: "Mini bus",
    seatOptions: [21, 25, 32],
    typicalUse: "Local functions, school",
  },
  coach_seater: {
    key: "coach_seater",
    label: "Coach — seater",
    seatOptions: [35, 40, 45, 49],
    typicalUse: "Corporate, pilgrimage",
  },
  coach_multi_axle: {
    key: "coach_multi_axle",
    label: "Coach — Volvo / Scania multi-axle",
    seatOptions: [41, 45, 49],
    typicalUse: "Premium long distance",
  },
  sleeper_coach: {
    key: "sleeper_coach",
    label: "Sleeper coach",
    seatOptions: [30, 36, 40],
    typicalUse: "Overnight",
  },
  double_decker: {
    key: "double_decker",
    label: "Double-decker / open-top",
    seatOptions: [50, 60, 70],
    typicalUse: "Events, tourism",
  },
}

export function vehicleClassLabel(vehicleClass: VehicleClass): string {
  return VEHICLE_CLASS_INFO[vehicleClass].label
}

/** "9–26 seats", for dropdowns. The full ladder stays on cards and guides. */
export function seatRange(info: VehicleClassInfo): string {
  const seats = info.seatOptions
  const min = Math.min(...seats)
  const max = Math.max(...seats)
  return min === max ? `${min} seats` : `${min}–${max} seats`
}

/** §4.6's attribute list, as options rather than free text. */
export const VEHICLE_FEATURES = [
  { key: "pushback", label: "Push-back seats" },
  { key: "luggage_carrier", label: "Luggage carrier" },
  { key: "led_tv", label: "LED / TV" },
  { key: "mic", label: "Mic system" },
  { key: "washroom", label: "Washroom" },
  { key: "wheelchair_accessible", label: "Wheelchair accessible" },
] as const

export function featureLabel(key: string): string {
  return VEHICLE_FEATURES.find((feature) => feature.key === key)?.label ?? key
}

/**
 * §4.1: passenger count suggests a vehicle configuration.
 *
 * Returns every class-and-seat combination that seats the group, cheapest
 * class first, plus how many vehicles it would take. A group of 34 is either
 * one 35-seat coach or two 17-seat tempo travellers, and which is better
 * depends on the route — so both are offered rather than one being guessed at.
 */
export type Suggestion = {
  vehicleClass: VehicleClass
  seats: number
  count: number
  spareSeats: number
}

export function suggestConfigurations(passengers: number): Suggestion[] {
  if (passengers <= 0) return []

  const suggestions: Suggestion[] = []

  for (const info of Object.values(VEHICLE_CLASS_INFO)) {
    for (const seats of info.seatOptions) {
      const count = Math.ceil(passengers / seats)
      // Two vehicles is a real answer; five is a convoy nobody wants to manage.
      if (count > 3) continue
      const spareSeats = seats * count - passengers
      // More than half a vehicle empty means the class below fits better.
      if (spareSeats >= seats) continue
      suggestions.push({ vehicleClass: info.key, seats, count, spareSeats })
    }
  }

  return suggestions.sort((a, b) => a.count - b.count || a.spareSeats - b.spareSeats)
}

/**
 * §9's lifecycle: `draft → pending_verification → active → suspended → retired`.
 *
 * Encoded as allowed transitions because the interesting ones are the moves
 * that must *not* happen: a suspended vehicle cannot quietly become active
 * again without passing verification, which is what makes an expired-insurance
 * suspension mean something.
 */
export const VEHICLE_STATUSES = [
  "draft",
  "pending_verification",
  "active",
  "suspended",
  "retired",
] as const

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

const TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  draft: ["pending_verification", "retired"],
  pending_verification: ["active", "draft", "retired"],
  active: ["suspended", "retired"],
  suspended: ["pending_verification", "retired"],
  retired: [],
}

export function canTransition(from: VehicleStatus, to: VehicleStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function allowedTransitions(from: VehicleStatus): VehicleStatus[] {
  return TRANSITIONS[from]
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  draft: "Draft",
  pending_verification: "Pending verification",
  active: "Active",
  suspended: "Suspended",
  retired: "Retired",
}
