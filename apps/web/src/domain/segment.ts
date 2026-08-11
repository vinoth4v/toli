import { VEHICLE_CLASS_INFO, type VehicleClass } from "./vehicle.ts"

/**
 * Segments — the Europcar idea, applied to Indian charter.
 *
 * A customer choosing a vehicle does not want to reason about seat counts and
 * feature checkboxes; they want to know what the inside will be like. Car
 * rental solved this decades ago with a ladder of named tiers, and this is the
 * same ladder for a market where the meaningful rungs are *is there air
 * conditioning* and *can the seat recline on a nine-hour drive*.
 *
 * Segment is orthogonal to class. A 17-seat tempo traveller can be economy or
 * luxury; a 45-seat coach can be either. Class answers "how many of us fit",
 * segment answers "what is it like in there", and pricing needs both.
 */

export const SEGMENTS = ["economy", "premium", "luxury"] as const

export type Segment = (typeof SEGMENTS)[number]

export type SegmentInfo = {
  key: Segment
  label: string
  /** Three words for a dropdown. A sentence inside a <select> is unreadable. */
  short: string
  /** One line, on the card a customer picks from. */
  promise: string
  /** What must be true of a vehicle to sit in this segment. */
  requires: { ac: boolean; features: string[] }
  /** Shown as ticks on the card. */
  includes: string[]
  /** Indicative multiplier against the economy rate, for display only. */
  indicativeIndex: number
}

export const SEGMENT_INFO: Record<Segment, SegmentInfo> = {
  economy: {
    key: "economy",
    label: "Economy",
    short: "Non-AC",
    promise: "Non-AC. The workhorse — gets everyone there, cheapest per seat.",
    requires: { ac: false, features: [] },
    includes: ["Seats everyone", "Luggage carrier", "Verified driver"],
    indicativeIndex: 1,
  },
  premium: {
    key: "premium",
    label: "Premium",
    short: "AC",
    promise: "Air conditioned. What most groups actually want in an Indian summer.",
    requires: { ac: true, features: [] },
    includes: ["Air conditioned", "Luggage carrier", "Verified driver", "Newer vehicles"],
    indicativeIndex: 1.25,
  },
  luxury: {
    key: "luxury",
    label: "Luxury",
    short: "AC · push-back",
    promise: "AC with push-back seats — for long drives, weddings and clients you are hosting.",
    requires: { ac: true, features: ["pushback"] },
    includes: [
      "Air conditioned",
      "Push-back seats",
      "Entertainment where fitted",
      "Newest vehicles first",
    ],
    indicativeIndex: 1.6,
  },
}

export function segmentLabel(segment: Segment): string {
  return SEGMENT_INFO[segment].label
}

/**
 * The segment a vehicle honestly belongs to, from what it actually has.
 *
 * Derived rather than typed in, because a self-declared "luxury" non-AC bus is
 * exactly the sort of claim this marketplace exists to stop. An operator can
 * only move a vehicle up a segment by fitting the thing the segment promises.
 */
export function segmentFor(vehicle: { ac: boolean; features: readonly string[] }): Segment {
  if (!vehicle.ac) return "economy"
  return vehicle.features.includes("pushback") ? "luxury" : "premium"
}

/**
 * Whether a vehicle may be sold as a given segment.
 *
 * A customer who paid for Luxury and got Premium has been mis-sold; a customer
 * who asked for Economy and is given a Luxury vehicle has not — so this is
 * deliberately one-directional. An operator with only reclining coaches free
 * can still serve an economy booking, at the economy price.
 */
export function satisfies(
  vehicle: { ac: boolean; features: readonly string[] },
  wanted: Segment,
): boolean {
  const actual = segmentFor(vehicle)
  return SEGMENT_RANK[actual] >= SEGMENT_RANK[wanted]
}

const SEGMENT_RANK: Record<Segment, number> = { economy: 0, premium: 1, luxury: 2 }

export function rankOf(segment: Segment): number {
  return SEGMENT_RANK[segment]
}

/**
 * What to show a group of a given size, per segment.
 *
 * The seat ladder is the vehicle taxonomy's, so a segment card can say "a
 * 17-seat tempo traveller" rather than the abstract noun.
 */
export function classesForGroup(passengers: number): VehicleClass[] {
  return Object.values(VEHICLE_CLASS_INFO)
    .filter((info) => info.seatOptions.some((seats) => seats >= passengers))
    .map((info) => info.key)
}
