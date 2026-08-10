/**
 * The fixed vocabularies the app is written against.
 *
 * Text columns rather than Postgres enums: adding a vehicle class should be a
 * one-line change and a deploy, not a migration that locks the table. The
 * cost is that the database will not reject a bad value, so everything that
 * writes one goes through the parsers here.
 */

export const VEHICLE_KINDS = [
  { value: "van", label: "Van", typicalSeats: 7 },
  { value: "tempo_traveller", label: "Tempo traveller", typicalSeats: 13 },
  { value: "mini_bus", label: "Mini bus", typicalSeats: 27 },
  { value: "coach", label: "Coach", typicalSeats: 49 },
] as const

export type VehicleKind = (typeof VEHICLE_KINDS)[number]["value"]

export const SEGMENTS = [
  { value: "wedding", label: "Wedding or family function" },
  { value: "corporate", label: "Corporate offsite or event" },
  { value: "pilgrimage", label: "Pilgrimage or religious group" },
  { value: "school", label: "School or college trip" },
  { value: "employee", label: "Employee daily transport" },
] as const

export type Segment = (typeof SEGMENTS)[number]["value"]

function labelFrom(
  options: readonly { value: string; label: string }[],
  value: string,
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback
}

export function vehicleKindLabel(value: string): string {
  return labelFrom(VEHICLE_KINDS, value, value)
}

export function segmentLabel(value: string): string {
  return labelFrom(SEGMENTS, value, value)
}

export function isVehicleKind(value: string): value is VehicleKind {
  return VEHICLE_KINDS.some((kind) => kind.value === value)
}

export function isSegment(value: string): value is Segment {
  return SEGMENTS.some((segment) => segment.value === value)
}

/** Ordered smallest to largest, which is what "at least this big" means. */
const CAPACITY_ORDER: VehicleKind[] = ["van", "tempo_traveller", "mini_bus", "coach"]

/**
 * Whether a vehicle of `offered` class can answer a request for `wanted`.
 *
 * Bigger is acceptable and smaller is not: a group that asked for a tempo
 * traveller will take a mini bus, and will not take a van. Seat count still
 * has to be checked separately — a 13-seat tempo traveller is not a 20-seat
 * one, whatever the class says.
 */
export function classSatisfies(offered: string, wanted: string): boolean {
  const offeredIndex = CAPACITY_ORDER.indexOf(offered as VehicleKind)
  const wantedIndex = CAPACITY_ORDER.indexOf(wanted as VehicleKind)
  if (offeredIndex < 0 || wantedIndex < 0) return offered === wanted
  return offeredIndex >= wantedIndex
}
