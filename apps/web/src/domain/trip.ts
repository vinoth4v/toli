/**
 * Trip types, and the one thing that follows from them: how a quote is priced.
 *
 * §4.1's requirement builder offers these; §7.1's quote schema has two
 * distinct shapes; and which shape applies is decided here rather than by the
 * operator, so that five quotes for the same trip are always comparable.
 */

export const TRIP_TYPES = [
  "one_way",
  "round_trip",
  "multi_day_tour",
  "local_package_8_80",
  "local_package_12_120",
  "airport_transfer",
  "recurring",
] as const

export type TripType = (typeof TRIP_TYPES)[number]

export type TripTypeInfo = {
  key: TripType
  label: string
  /** `package` bills a base fare plus overage; `distance` bills per km with a daily floor. */
  basis: "package" | "distance"
  /** Pre-fills the requirement builder — the package sizes are market standard. */
  defaultIncludedKm?: number
  defaultIncludedHours?: number
  hint: string
}

export const TRIP_TYPE_INFO: Record<TripType, TripTypeInfo> = {
  one_way: {
    key: "one_way",
    label: "One way",
    basis: "distance",
    hint: "Point to point. Operators usually still charge a return-empty component in the per-km rate.",
  },
  round_trip: {
    key: "round_trip",
    label: "Round trip",
    basis: "distance",
    hint: "Out and back. Minimum km per day is the number to watch.",
  },
  multi_day_tour: {
    key: "multi_day_tour",
    label: "Multi-day tour",
    basis: "distance",
    hint: "Driver bata and night halt apply per day and per night.",
  },
  local_package_8_80: {
    key: "local_package_8_80",
    label: "Local package — 8 hr / 80 km",
    basis: "package",
    defaultIncludedKm: 80,
    defaultIncludedHours: 8,
    hint: "The standard city package. Overage is billed per extra km and per extra hour.",
  },
  local_package_12_120: {
    key: "local_package_12_120",
    label: "Local package — 12 hr / 120 km",
    basis: "package",
    defaultIncludedKm: 120,
    defaultIncludedHours: 12,
    hint: "Full-day city use — weddings, conferences.",
  },
  airport_transfer: {
    key: "airport_transfer",
    label: "Airport transfer",
    basis: "package",
    defaultIncludedKm: 40,
    defaultIncludedHours: 3,
    hint: "Fixed slab plus waiting charges. Flight delay is the usual dispute.",
  },
  recurring: {
    key: "recurring",
    label: "Recurring",
    basis: "package",
    defaultIncludedKm: 60,
    defaultIncludedHours: 4,
    hint: "Employee or school transport. Priced per running day against a monthly contract.",
  },
}

export function pricingBasis(tripType: TripType): "package" | "distance" {
  return TRIP_TYPE_INFO[tripType].basis
}

export function tripTypeLabel(tripType: TripType): string {
  return TRIP_TYPE_INFO[tripType].label
}

/**
 * The extras §4.1 lets a customer ask for. Free text would make these
 * unmatchable across operators, which is the whole disease being treated.
 */
export const TRIP_EXTRAS = [
  { key: "uniformed_driver", label: "Driver in uniform" },
  { key: "decorated_vehicle", label: "Decorated vehicle (wedding)" },
  { key: "music_system", label: "Music system" },
  { key: "hostess", label: "Hostess" },
  { key: "first_aid", label: "First aid kit" },
  { key: "guest_tracking_link", label: "Live tracking link for guests" },
] as const

export function extraLabel(key: string): string {
  return TRIP_EXTRAS.find((extra) => extra.key === key)?.label ?? key
}

/** IST is UTC+5:30 and has no daylight saving, so a fixed offset is correct. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 86_400_000

/**
 * Days and nights, from the two ends of a trip.
 *
 * Bata is per day and night halt is per night, so an off-by-one here is a real
 * ₹800 argument with an operator. A trip that starts and ends on the same
 * calendar day is one day and no nights; each further midnight crossed adds
 * one of each.
 *
 * Midnights are counted in IST, not UTC: a trip returning at 11 PM on Sunday
 * is still one day, but in UTC that instant is already Monday and the operator
 * would be paid for a night nobody spent away.
 */
export function tripDuration(startAt: Date, endAt: Date | null): { days: number; nights: number } {
  if (!endAt || endAt <= startAt) return { days: 1, nights: 0 }

  const startDay = Math.floor((startAt.getTime() + IST_OFFSET_MS) / DAY_MS)
  const endDay = Math.floor((endAt.getTime() + IST_OFFSET_MS) / DAY_MS)
  const nights = endDay - startDay

  return { days: nights + 1, nights }
}
