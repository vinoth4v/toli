import { classSatisfies } from "./catalog.ts"

/**
 * Who to send a requirement to.
 *
 * Deliberately dumb, and deliberately explainable: same city, a vehicle class
 * at least as big as the one asked for, and enough seats across the number of
 * vehicles needed. No score nobody can audit — when the desk asks "why did
 * this operator not get the RFQ", the answer has to be one sentence.
 */

export type MatchableVehicle = {
  kind: string
  seats: number
  active: boolean
}

export type MatchableOperator = {
  id: string
  name: string
  city: string
  verified: boolean
  vehicles: MatchableVehicle[]
}

export type Requirement = {
  fromCity: string
  vehicleKind: string
  passengers: number
  vehiclesNeeded: number
}

export type Match = {
  operator: MatchableOperator
  /** Total seats across the best-fitting vehicles it could send. */
  capacity: number
  /** How many of the vehicles asked for it can actually field. */
  vehiclesAvailable: number
  /** The largest single vehicle it would send, for the "what turns up" line. */
  bestVehicle: MatchableVehicle
  /** True when it can field the fleet but not seat the group in it. */
  partial: boolean
}

function sameCity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Operators that can serve this requirement — full fits first, then partial
 * ones, verified ahead of unverified, roomier fleets ahead of tighter.
 *
 * An operator with no vehicle of a suitable class is absent rather than
 * ranked last: sending an RFQ to somebody who cannot answer it is how a
 * marketplace teaches its supply side to ignore notifications.
 *
 * A *partial* match is kept and labelled rather than dropped. An operator
 * with two of the three coaches needed is exactly who the desk wants on the
 * phone — the third coach comes from somewhere else, and that is a normal
 * wedding, not an error.
 */
export function matchOperators(requirement: Requirement, operators: MatchableOperator[]): Match[] {
  const vehiclesNeeded = Math.max(1, requirement.vehiclesNeeded)
  const matches: Match[] = []

  for (const operator of operators) {
    if (!sameCity(operator.city, requirement.fromCity)) continue

    const fleet = operator.vehicles
      .filter((vehicle) => vehicle.active && classSatisfies(vehicle.kind, requirement.vehicleKind))
      .sort((a, b) => b.seats - a.seats)
      .slice(0, vehiclesNeeded)

    const bestVehicle = fleet[0]
    if (!bestVehicle) continue

    const capacity = fleet.reduce((seats, vehicle) => seats + vehicle.seats, 0)

    matches.push({
      operator,
      capacity,
      vehiclesAvailable: fleet.length,
      bestVehicle,
      partial: fleet.length < vehiclesNeeded || capacity < requirement.passengers,
    })
  }

  return matches.sort((a, b) => {
    if (a.partial !== b.partial) return a.partial ? 1 : -1
    if (a.operator.verified !== b.operator.verified) return a.operator.verified ? -1 : 1
    return b.capacity - a.capacity
  })
}
