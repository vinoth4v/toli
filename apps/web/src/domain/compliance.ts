/**
 * Vehicle and permit compliance — §8.5, and the "hard auto-suspension" of §4.2.
 *
 * The plan calls this non-negotiable, and it is the one rule in the app that
 * overrides commercial judgement: a vehicle whose insurance lapsed yesterday
 * does not take a booking today, however good the operator and however full
 * the wedding season. The consequence of the other choice is a coach detained
 * at a border post at 2 AM with forty passengers inside.
 *
 * Everything here is a pure function of documents and dates, so the same rule
 * decides what the fleet screen shows, what the compliance queue lists, and
 * whether a vehicle may be assigned to a trip.
 */

export const DOCUMENT_KINDS = [
  "rc",
  "state_permit",
  "aitp",
  "fitness",
  "insurance",
  "puc",
  "vltd",
] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  rc: "Registration certificate",
  state_permit: "State tourist permit",
  aitp: "All India Tourist Permit",
  fitness: "Fitness certificate",
  insurance: "Commercial insurance",
  puc: "PUC",
  vltd: "AIS-140 VLTD certificate",
}

/**
 * What every vehicle must hold to carry passengers at all.
 *
 * AITP is deliberately not here: it is required only for interstate work, and
 * demanding it of a vehicle that only ever runs city packages would suspend
 * half the fleet for no safety reason.
 */
export const DOCUMENTS_REQUIRED_ALWAYS: DocumentKind[] = [
  "rc",
  "fitness",
  "insurance",
  "puc",
  "vltd",
]

/** §8.5: AITP is what makes an interstate charter legal. */
export const DOCUMENTS_REQUIRED_INTERSTATE: DocumentKind[] = ["aitp"]

/**
 * AITP is typically not granted past 12 years from first registration, and
 * some states are stricter. Encoded as a rule so a 13-year-old coach is
 * refused at listing time rather than at a check post.
 */
export const AITP_MAX_VEHICLE_AGE_YEARS = 12

/** §4.2's reminder ladder. Ordered most urgent first; the first match wins. */
export const EXPIRY_WARNING_DAYS = [7, 15, 30] as const

export type ExpiryBucket = "missing" | "expired" | "critical" | "soon" | "watch" | "ok"

export type DocumentLike = {
  kind: DocumentKind
  expiresOn: string | null
  verification: "pending" | "verified" | "rejected"
}

const DAY_MS = 86_400_000

/** Whole days from `asOf` to an ISO date, negative once it is in the past. */
export function daysUntil(isoDate: string, asOf: Date): number {
  const expiry = Date.parse(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(expiry)) return Number.NaN
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
  return Math.round((expiry - today) / DAY_MS)
}

export function expiryBucket(expiresOn: string | null, asOf: Date): ExpiryBucket {
  if (!expiresOn) return "missing"
  const days = daysUntil(expiresOn, asOf)
  if (Number.isNaN(days)) return "missing"
  if (days < 0) return "expired"
  if (days <= 7) return "critical"
  if (days <= 15) return "soon"
  if (days <= 30) return "watch"
  return "ok"
}

export type ComplianceProblem = {
  kind: DocumentKind | "age"
  severity: "blocking" | "warning"
  message: string
}

export type ComplianceAssessment = {
  problems: ComplianceProblem[]
  /** Blocking problems only — the reasons a vehicle may not be booked. */
  blockers: ComplianceProblem[]
  /** True when nothing blocks ordinary (intrastate) work. */
  fitForService: boolean
  /** True when the vehicle may additionally cross a state border. */
  fitForInterstate: boolean
  /** Filled when a suspension is warranted, ready to store as the reason. */
  suspensionReason: string | null
}

/**
 * Judges one vehicle against its documents.
 *
 * `asOf` is a parameter rather than `new Date()` so this is testable, and so
 * the same function can answer "is this vehicle legal on the day of the trip",
 * which is the question that actually matters when a booking is three weeks
 * out and the permit expires in two.
 */
export function assessVehicle(input: {
  documents: readonly DocumentLike[]
  yearOfManufacture: number
  asOf: Date
}): ComplianceAssessment {
  const { documents, yearOfManufacture, asOf } = input
  const problems: ComplianceProblem[] = []

  const byKind = new Map<DocumentKind, DocumentLike>()
  for (const document of documents) {
    // Keep the one that expires latest: operators re-upload on renewal rather
    // than editing, so the newest certificate is the one in force.
    const existing = byKind.get(document.kind)
    if (!existing || (document.expiresOn ?? "") > (existing.expiresOn ?? "")) {
      byKind.set(document.kind, document)
    }
  }

  for (const kind of [...DOCUMENTS_REQUIRED_ALWAYS, ...DOCUMENTS_REQUIRED_INTERSTATE]) {
    const interstateOnly = DOCUMENTS_REQUIRED_INTERSTATE.includes(kind)
    const document = byKind.get(kind)
    const label = DOCUMENT_LABELS[kind]

    if (!document) {
      problems.push({
        kind,
        severity: interstateOnly ? "warning" : "blocking",
        message: interstateOnly
          ? `${label} not on file — interstate trips cannot be assigned`
          : `${label} not on file`,
      })
      continue
    }

    if (document.verification === "rejected") {
      problems.push({
        kind,
        severity: interstateOnly ? "warning" : "blocking",
        message: `${label} was rejected in verification`,
      })
      continue
    }

    const bucket = expiryBucket(document.expiresOn, asOf)
    if (bucket === "expired") {
      problems.push({
        kind,
        severity: interstateOnly ? "warning" : "blocking",
        message: `${label} expired on ${document.expiresOn}`,
      })
    } else if (bucket === "missing") {
      problems.push({
        kind,
        severity: interstateOnly ? "warning" : "blocking",
        message: `${label} has no expiry date recorded`,
      })
    } else if (bucket === "critical" || bucket === "soon" || bucket === "watch") {
      problems.push({
        kind,
        severity: "warning",
        message: `${label} expires in ${daysUntil(document.expiresOn ?? "", asOf)} days`,
      })
    } else if (document.verification === "pending") {
      problems.push({ kind, severity: "warning", message: `${label} is awaiting verification` })
    }
  }

  const age = asOf.getUTCFullYear() - yearOfManufacture
  if (age > AITP_MAX_VEHICLE_AGE_YEARS) {
    problems.push({
      kind: "age",
      severity: "warning",
      message: `${age} years old — past the ${AITP_MAX_VEHICLE_AGE_YEARS}-year limit for an All India Tourist Permit`,
    })
  }

  const blockers = problems.filter((problem) => problem.severity === "blocking")
  const interstateBlocked =
    blockers.length > 0 ||
    problems.some((problem) => problem.kind === "aitp") ||
    age > AITP_MAX_VEHICLE_AGE_YEARS

  return {
    problems,
    blockers,
    fitForService: blockers.length === 0,
    fitForInterstate: !interstateBlocked,
    suspensionReason: blockers.length > 0 ? blockers.map((b) => b.message).join("; ") : null,
  }
}

/**
 * Whether this vehicle may be assigned to this trip.
 *
 * Kept separate from `assessVehicle` because it is the question with a
 * consequence: the assignment form calls it, and refuses.
 */
export function canAssignToTrip(
  assessment: ComplianceAssessment,
  trip: { interstate: boolean },
): { allowed: boolean; reason: string | null } {
  if (!assessment.fitForService) {
    return { allowed: false, reason: assessment.blockers.map((b) => b.message).join("; ") }
  }
  if (trip.interstate && !assessment.fitForInterstate) {
    return {
      allowed: false,
      reason:
        "Interstate trip requires a valid All India Tourist Permit on a vehicle within the age limit",
    }
  }
  return { allowed: true, reason: null }
}

/** §4.2's driver-side conditions, which §8.4 turned into licence obligations. */
export function assessDriver(input: {
  dlExpiresOn: string | null
  policeVerifiedOn: string | null
  medicalCheckedOn: string | null
  inductionTrainedOn: string | null
  asOf: Date
}): ComplianceProblem[] {
  const problems: ComplianceProblem[] = []
  const bucket = expiryBucket(input.dlExpiresOn, input.asOf)

  if (bucket === "missing") {
    problems.push({ kind: "rc", severity: "blocking", message: "Driving licence not on file" })
  } else if (bucket === "expired") {
    problems.push({
      kind: "rc",
      severity: "blocking",
      message: `Driving licence expired on ${input.dlExpiresOn}`,
    })
  } else if (bucket !== "ok") {
    problems.push({
      kind: "rc",
      severity: "warning",
      message: `Driving licence expires in ${daysUntil(input.dlExpiresOn ?? "", input.asOf)} days`,
    })
  }

  if (!input.policeVerifiedOn) {
    problems.push({
      kind: "rc",
      severity: "blocking",
      message: "Police verification missing — required before onboarding under MVAG 2025",
    })
  }
  if (!input.medicalCheckedOn) {
    problems.push({ kind: "rc", severity: "warning", message: "Medical test not recorded" })
  }
  if (!input.inductionTrainedOn) {
    problems.push({ kind: "rc", severity: "warning", message: "Induction training not recorded" })
  }

  return problems
}
