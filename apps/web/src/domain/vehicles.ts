/**
 * The vehicle classes this marketplace charters, and the default rate card for
 * each.
 *
 * The class is the unit customers actually shop in — nobody books "a Force
 * Traveller 3350", they book "a tempo traveller for 14". Rates are indicative
 * national defaults; a real operator's own rate overrides them per vehicle, so
 * this table is a starting point rather than a price list.
 */

import { PAISE } from "@/domain/money"

export const VEHICLE_CLASSES = ["van", "tempo_traveller", "mini_bus", "coach"] as const

export type VehicleClass = (typeof VEHICLE_CLASSES)[number]

export type RateCard = {
  readonly label: string
  /** Typical seating, excluding the driver. Used to suggest a class. */
  readonly seats: number
  readonly perKmPaise: number
  /** Billed floor per day on any trip that keeps the vehicle overnight. */
  readonly minimumKmPerDay: number
  /** The driver's daily allowance — "bhatta" on every Indian charter invoice. */
  readonly driverAllowancePerDayPaise: number
  /** Added per night away from base, on top of the daily allowance. */
  readonly nightHaltPaise: number
}

export const RATE_CARDS: Record<VehicleClass, RateCard> = {
  van: {
    label: "Van (Ertiga / Innova class)",
    seats: 7,
    perKmPaise: 22 * PAISE,
    minimumKmPerDay: 250,
    driverAllowancePerDayPaise: 400 * PAISE,
    nightHaltPaise: 300 * PAISE,
  },
  tempo_traveller: {
    label: "Tempo traveller",
    seats: 14,
    perKmPaise: 30 * PAISE,
    minimumKmPerDay: 250,
    driverAllowancePerDayPaise: 500 * PAISE,
    nightHaltPaise: 400 * PAISE,
  },
  mini_bus: {
    label: "Mini bus",
    seats: 27,
    perKmPaise: 48 * PAISE,
    minimumKmPerDay: 300,
    driverAllowancePerDayPaise: 700 * PAISE,
    nightHaltPaise: 500 * PAISE,
  },
  coach: {
    label: "Coach",
    seats: 49,
    perKmPaise: 68 * PAISE,
    minimumKmPerDay: 300,
    driverAllowancePerDayPaise: 900 * PAISE,
    nightHaltPaise: 600 * PAISE,
  },
}

export function isVehicleClass(value: string): value is VehicleClass {
  return (VEHICLE_CLASSES as readonly string[]).includes(value)
}

export function vehicleClassLabel(value: VehicleClass): string {
  return RATE_CARDS[value].label
}

/**
 * The cheapest class that seats the group.
 *
 * Falls back to the largest class rather than refusing: a 60-person group is a
 * real enquiry that wants two coaches, and the operator sorts that out on the
 * quote. Returning nothing would just lose the lead.
 */
export function suggestVehicleClass(passengers: number): VehicleClass {
  return VEHICLE_CLASSES.find((klass) => RATE_CARDS[klass].seats >= passengers) ?? "coach"
}

/** Permit types that matter for an interstate charter. */
export const PERMIT_TYPES = ["contract_carriage", "all_india_tourist"] as const

export type PermitType = (typeof PERMIT_TYPES)[number]

export const PERMIT_LABELS: Record<PermitType, string> = {
  contract_carriage: "State contract carriage",
  all_india_tourist: "All-India tourist permit",
}
