import { describe, expect, it } from "vitest"
import { classSatisfies } from "./catalog.ts"
import { type MatchableOperator, matchOperators, type Requirement } from "./matching.ts"

function operator(overrides: Partial<MatchableOperator> = {}): MatchableOperator {
  return {
    id: "op-1",
    name: "Sharma Travels",
    city: "Jaipur",
    verified: true,
    vehicles: [{ kind: "tempo_traveller", seats: 13, active: true }],
    ...overrides,
  }
}

const requirement: Requirement = {
  fromCity: "Jaipur",
  vehicleKind: "tempo_traveller",
  passengers: 12,
  vehiclesNeeded: 1,
}

describe("classSatisfies", () => {
  it("lets a bigger class answer a smaller request", () => {
    expect(classSatisfies("mini_bus", "tempo_traveller")).toBe(true)
    expect(classSatisfies("coach", "van")).toBe(true)
  })

  it("does not let a smaller class answer a bigger request", () => {
    expect(classSatisfies("van", "coach")).toBe(false)
  })

  it("falls back to exact equality for a class it does not know", () => {
    expect(classSatisfies("hovercraft", "hovercraft")).toBe(true)
    expect(classSatisfies("hovercraft", "coach")).toBe(false)
  })
})

describe("matchOperators", () => {
  it("matches an operator in the same city with a suitable vehicle", () => {
    const matches = matchOperators(requirement, [operator()])

    expect(matches).toHaveLength(1)
    expect(matches[0]?.capacity).toBe(13)
    expect(matches[0]?.partial).toBe(false)
  })

  it("ignores case and stray whitespace in the city", () => {
    expect(matchOperators(requirement, [operator({ city: "  jaipur " })])).toHaveLength(1)
  })

  it("drops an operator in another city", () => {
    expect(matchOperators(requirement, [operator({ city: "Udaipur" })])).toHaveLength(0)
  })

  it("drops an operator whose only vehicle is too small a class", () => {
    const tooSmall = operator({ vehicles: [{ kind: "van", seats: 7, active: true }] })

    expect(matchOperators(requirement, [tooSmall])).toHaveLength(0)
  })

  it("ignores vehicles that are off the road", () => {
    const grounded = operator({
      vehicles: [{ kind: "tempo_traveller", seats: 13, active: false }],
    })

    expect(matchOperators(requirement, [grounded])).toHaveLength(0)
  })

  it("keeps an operator that can seat only part of the group, and says so", () => {
    const big: Requirement = { ...requirement, passengers: 40, vehiclesNeeded: 3 }
    const matches = matchOperators(big, [operator()])

    expect(matches).toHaveLength(1)
    expect(matches[0]?.partial).toBe(true)
    expect(matches[0]?.vehiclesAvailable).toBe(1)
  })

  it("sends the request to the largest vehicles an operator has", () => {
    const mixed = operator({
      vehicles: [
        { kind: "tempo_traveller", seats: 13, active: true },
        { kind: "mini_bus", seats: 27, active: true },
      ],
    })
    const matches = matchOperators(requirement, [mixed])

    expect(matches[0]?.bestVehicle.seats).toBe(27)
    expect(matches[0]?.capacity).toBe(27)
  })

  it("ranks full fits above partial ones, and verified above unverified", () => {
    const partialButVerified = operator({
      id: "partial",
      vehicles: [{ kind: "tempo_traveller", seats: 13, active: true }],
    })
    const fullButUnverified = operator({
      id: "full",
      verified: false,
      vehicles: [{ kind: "coach", seats: 49, active: true }],
    })
    const fullAndVerified = operator({
      id: "best",
      vehicles: [{ kind: "mini_bus", seats: 27, active: true }],
    })

    const big: Requirement = { ...requirement, passengers: 20, vehiclesNeeded: 1 }
    const ranked = matchOperators(big, [partialButVerified, fullButUnverified, fullAndVerified])

    expect(ranked.map((match) => match.operator.id)).toEqual(["best", "full", "partial"])
  })
})
