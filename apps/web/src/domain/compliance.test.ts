import { describe, expect, it } from "vitest"
import {
  assessDriver,
  assessVehicle,
  canAssignToTrip,
  type DocumentLike,
  expiryBucket,
} from "./compliance.ts"

const asOf = new Date("2026-08-10T00:00:00Z")

function docs(overrides: Partial<Record<string, string | null>> = {}): DocumentLike[] {
  const base: Record<string, string | null> = {
    rc: "2030-01-01",
    fitness: "2027-03-31",
    insurance: "2027-06-30",
    puc: "2026-12-31",
    vltd: "2028-01-01",
    aitp: "2027-01-31",
    ...overrides,
  }

  return Object.entries(base)
    .filter(([, expiresOn]) => expiresOn !== null)
    .map(([kind, expiresOn]) => ({
      kind: kind as DocumentLike["kind"],
      expiresOn,
      verification: "verified" as const,
    }))
}

describe("expiryBucket", () => {
  it("buckets by the reminder ladder of §4.2", () => {
    expect(expiryBucket("2026-08-09", asOf)).toBe("expired")
    expect(expiryBucket("2026-08-15", asOf)).toBe("critical")
    expect(expiryBucket("2026-08-24", asOf)).toBe("soon")
    expect(expiryBucket("2026-09-05", asOf)).toBe("watch")
    expect(expiryBucket("2027-01-01", asOf)).toBe("ok")
    expect(expiryBucket(null, asOf)).toBe("missing")
  })

  it("treats the expiry day itself as still valid", () => {
    expect(expiryBucket("2026-08-10", asOf)).toBe("critical")
  })
})

describe("assessVehicle", () => {
  it("passes a fully documented vehicle", () => {
    const assessment = assessVehicle({ documents: docs(), yearOfManufacture: 2022, asOf })

    expect(assessment.fitForService).toBe(true)
    expect(assessment.fitForInterstate).toBe(true)
    expect(assessment.suspensionReason).toBeNull()
  })

  it("blocks a vehicle whose insurance lapsed — the non-negotiable of §4.2", () => {
    const assessment = assessVehicle({
      documents: docs({ insurance: "2026-08-01" }),
      yearOfManufacture: 2022,
      asOf,
    })

    expect(assessment.fitForService).toBe(false)
    expect(assessment.suspensionReason).toContain("insurance")
  })

  it("blocks a vehicle with no AIS-140 device on file", () => {
    const assessment = assessVehicle({
      documents: docs({ vltd: null }),
      yearOfManufacture: 2022,
      asOf,
    })

    expect(assessment.fitForService).toBe(false)
  })

  it("lets a vehicle without an AITP work locally but not across a border", () => {
    // The distinction that keeps half the fleet from being suspended for a
    // permit city packages never needed.
    const assessment = assessVehicle({
      documents: docs({ aitp: null }),
      yearOfManufacture: 2022,
      asOf,
    })

    expect(assessment.fitForService).toBe(true)
    expect(assessment.fitForInterstate).toBe(false)
  })

  it("warns before it blocks, so the operator has 30 days of notice", () => {
    const assessment = assessVehicle({
      documents: docs({ fitness: "2026-08-25" }),
      yearOfManufacture: 2022,
      asOf,
    })

    expect(assessment.fitForService).toBe(true)
    expect(
      assessment.problems.some((problem) => problem.message.includes("expires in 15 days")),
    ).toBe(true)
  })

  it("keeps the later certificate when a renewal is uploaded beside the old one", () => {
    const assessment = assessVehicle({
      documents: [
        ...docs({ insurance: null }),
        { kind: "insurance", expiresOn: "2026-08-01", verification: "verified" },
        { kind: "insurance", expiresOn: "2027-08-01", verification: "verified" },
      ],
      yearOfManufacture: 2022,
      asOf,
    })

    expect(assessment.fitForService).toBe(true)
  })

  it("bars an over-age vehicle from interstate work under the AITP age limit", () => {
    const assessment = assessVehicle({ documents: docs(), yearOfManufacture: 2011, asOf })

    expect(assessment.fitForService).toBe(true)
    expect(assessment.fitForInterstate).toBe(false)
    expect(assessment.problems.some((problem) => problem.kind === "age")).toBe(true)
  })

  it("treats a rejected document as though it were missing", () => {
    const assessment = assessVehicle({
      documents: [
        ...docs({ fitness: null }),
        { kind: "fitness", expiresOn: "2027-03-31", verification: "rejected" },
      ],
      yearOfManufacture: 2022,
      asOf,
    })

    expect(assessment.fitForService).toBe(false)
  })
})

describe("canAssignToTrip", () => {
  it("refuses an interstate assignment to a vehicle with no AITP", () => {
    const assessment = assessVehicle({
      documents: docs({ aitp: null }),
      yearOfManufacture: 2022,
      asOf,
    })
    const outcome = canAssignToTrip(assessment, { interstate: true })

    expect(outcome.allowed).toBe(false)
    expect(outcome.reason).toContain("All India Tourist Permit")
  })

  it("allows the same vehicle on a trip that stays in the state", () => {
    const assessment = assessVehicle({
      documents: docs({ aitp: null }),
      yearOfManufacture: 2022,
      asOf,
    })

    expect(canAssignToTrip(assessment, { interstate: false }).allowed).toBe(true)
  })
})

describe("assessDriver", () => {
  it("blocks a driver with no police verification", () => {
    const problems = assessDriver({
      dlExpiresOn: "2029-01-01",
      policeVerifiedOn: null,
      medicalCheckedOn: "2026-01-01",
      inductionTrainedOn: "2026-01-01",
      asOf,
    })

    expect(problems.some((problem) => problem.severity === "blocking")).toBe(true)
  })

  it("passes a fully cleared driver", () => {
    const problems = assessDriver({
      dlExpiresOn: "2029-01-01",
      policeVerifiedOn: "2026-01-01",
      medicalCheckedOn: "2026-01-01",
      inductionTrainedOn: "2026-01-01",
      asOf,
    })

    expect(problems).toEqual([])
  })
})
