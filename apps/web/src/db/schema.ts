import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * Toli's ops database.
 *
 * Two rules from the build plan (§9) run through everything here:
 * money is stored in **paise as integers**, never a float or a numeric that
 * a driver might hand back as a string; and every timestamp is UTC, rendered
 * in IST at the edge of the app.
 *
 * Nothing financial is ever deleted — bookings, payments, invoices and
 * settlements carry a status instead, because a settlement that vanished is
 * indistinguishable from one that never happened.
 */

/**
 * Append-only record of things worth knowing after the fact: sign-ins,
 * failed sign-ins, and every ops action that moves money or changes what a
 * customer is promised. §4.4 asks for "every admin action attributable"; this
 * is where that lives.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    kind: text("kind").notNull(),
    actor: text("actor"),
    detail: text("detail"),
  },
  (table) => [index("audit_log_at_idx").on(table.at)],
)

export type AuditLogRow = typeof auditLog.$inferSelect
export type NewAuditLogRow = typeof auditLog.$inferInsert

/* -------------------------------------------------------------------------
 * Enumerations
 *
 * Postgres enums rather than free text: the plan's whole argument is that
 * this market's misery comes from unstructured quotes and unstructured
 * vehicle descriptions. A typo'd vehicle class is a quote nobody can compare.
 * ---------------------------------------------------------------------- */

/** §4.6, the taxonomy the schema had to get right on day one. */
export const vehicleClassEnum = pgEnum("vehicle_class", [
  "mpv_suv",
  "tempo_traveller",
  "mini_bus",
  "coach_seater",
  "coach_multi_axle",
  "sleeper_coach",
  "double_decker",
])

/**
 * The Europcar ladder, applied to charter: economy is non-AC, premium is air
 * conditioned, luxury adds push-back seats. Stored rather than derived so a
 * query can filter on it, but always written from `segmentFor` — an operator
 * moves a vehicle up a rung by fitting the thing, not by claiming it.
 */
export const segmentEnum = pgEnum("vehicle_segment", ["economy", "premium", "luxury"])

/**
 * Which of the two products a booking came through.
 *
 * §11 calls these Lane A and Lane B: a quote fanned out to operators, and an
 * instant book against a standing rate. They produce the same booking and are
 * settled identically — but they convert differently and are worth telling
 * apart in the metrics from the first day.
 */
export const bookingSourceEnum = pgEnum("booking_source", ["quote", "instant"])

/** §9: `draft → pending_verification → active → suspended → retired`. */
export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "draft",
  "pending_verification",
  "active",
  "suspended",
  "retired",
])

export const operatorStatusEnum = pgEnum("operator_status", [
  "draft",
  "pending_verification",
  "active",
  "suspended",
])

/** §11 Phase 2 tiering, carried from the start because settlement speed keys off it. */
export const operatorTierEnum = pgEnum("operator_tier", ["bronze", "silver", "gold"])

/** §8.5. `aitp` is the one that strands passengers at a border post at 2 AM. */
export const documentKindEnum = pgEnum("document_kind", [
  "rc",
  "state_permit",
  "aitp",
  "fitness",
  "insurance",
  "puc",
  "vltd",
])

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "rejected",
])

/** §4.2: auto-verify against government sources, manual review for exceptions. */
export const complianceSourceEnum = pgEnum("compliance_source", [
  "vahan",
  "sarathi",
  "gstn",
  "manual",
])

export const tripTypeEnum = pgEnum("trip_type", [
  "one_way",
  "round_trip",
  "multi_day_tour",
  "local_package_8_80",
  "local_package_12_120",
  "airport_transfer",
  "recurring",
])

export const tripRequestStatusEnum = pgEnum("trip_request_status", [
  "open",
  "quoting",
  "booked",
  "expired",
  "cancelled",
])

export const quoteStatusEnum = pgEnum("quote_status", [
  "requested",
  "submitted",
  "accepted",
  "rejected",
  "expired",
  "withdrawn",
])

/**
 * §8.3, the unresolved tax question the plan says must not be resolved in
 * code. Both treatments are modelled and the applicable one is an attribute
 * of the booking, so a written CA opinion changes a setting rather than a
 * schema.
 */
export const gstTreatmentEnum = pgEnum("gst_treatment", [
  "passenger_transport_5",
  "passenger_transport_12",
  "rental_with_operator_18",
])

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "assigned",
  "in_transit",
  "completed",
  "cancelled",
])

export const paymentKindEnum = pgEnum("payment_kind", ["advance", "balance", "refund"])

export const paymentModeEnum = pgEnum("payment_mode", [
  "upi",
  "card",
  "netbanking",
  "neft",
  "cash_to_driver",
])

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "captured",
  "failed",
  "refunded",
])

export const tripEventKindEnum = pgEnum("trip_event_kind", [
  "dispatched",
  "started",
  "stop_reached",
  "deviation",
  "sos",
  "completed",
  "note",
])

export const expenseKindEnum = pgEnum("expense_kind", ["toll", "parking", "fuel", "state_permit"])

export const settlementStatusEnum = pgEnum("settlement_status", ["pending", "released", "paid"])

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "investigating",
  "resolved",
  "rejected",
])

/* -------------------------------------------------------------------------
 * Supply: operators, vehicles, drivers, documents
 * ---------------------------------------------------------------------- */

export const operator = pgTable(
  "operator",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    contactName: text("contact_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    pan: text("pan"),
    gstin: text("gstin"),
    status: operatorStatusEnum("status").notNull().default("pending_verification"),
    tier: operatorTierEnum("tier").notNull().default("bronze"),
    /**
     * Basis points, overriding the platform default when set. §7.4 starts at
     * 8–12%; a hand-negotiated launch operator is the reason this is nullable
     * rather than a copy of the default.
     */
    commissionBps: integer("commission_bps"),
    bankAccountLast4: text("bank_account_last4"),
    /** §10: off-platform dealing is the existential threat, so it is a field. */
    leakageFlagged: boolean("leakage_flagged").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("operator_city_idx").on(table.city)],
)

export const vehicle = pgTable(
  "vehicle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operator.id),
    registrationNumber: text("registration_number").notNull(),
    vehicleClass: vehicleClassEnum("vehicle_class").notNull(),
    seats: smallint("seats").notNull(),
    ac: boolean("ac").notNull().default(true),
    /** §4.6 and §8.5: shown to customers, and the input to the age-limit rule. */
    yearOfManufacture: smallint("year_of_manufacture").notNull(),
    fuelType: text("fuel_type"),
    /** pushback, luggage_carrier, led_tv, mic, washroom, wheelchair_accessible. */
    features: text("features").array().notNull().default([]),
    /** Derived from `ac` and `features`; see domain/segment.ts. */
    segment: segmentEnum("segment").notNull().default("economy"),
    photoCount: smallint("photo_count").notNull().default(0),
    status: vehicleStatusEnum("status").notNull().default("draft"),
    /** Enumerated in domain/compliance.ts, stored as text so a reason survives a code change. */
    suspensionReason: text("suspension_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vehicle_registration_idx").on(table.registrationNumber),
    index("vehicle_operator_idx").on(table.operatorId),
  ],
)

export const vehicleDocument = pgTable(
  "vehicle_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicle.id),
    kind: documentKindEnum("kind").notNull(),
    number: text("number"),
    issuedOn: date("issued_on"),
    /** A date, not a timestamp: a permit expires on a day, in India, not at an instant UTC. */
    expiresOn: date("expires_on"),
    verification: verificationStatusEnum("verification").notNull().default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (table) => [
    index("vehicle_document_vehicle_idx").on(table.vehicleId),
    index("vehicle_document_expiry_idx").on(table.expiresOn),
  ],
)

export const driver = pgTable(
  "driver",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operator.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    /**
     * Languages this driver actually speaks, as locale codes.
     *
     * §4.1 lets a customer ask for a driver who speaks their language, and in
     * a market like Madurai that is not a nicety: a Delhi family on the Kodai
     * circuit and a Tamil-speaking driver can spend two days unable to agree
     * where to stop for lunch. Stored per driver so the request can be matched
     * rather than hoped for.
     */
    languages: text("languages").array().notNull().default(["ta"]),
    dlNumber: text("dl_number"),
    dlExpiresOn: date("dl_expires_on"),
    /** §8.4 makes all three a licence condition, not a nicety. */
    policeVerifiedOn: date("police_verified_on"),
    medicalCheckedOn: date("medical_checked_on"),
    inductionTrainedOn: date("induction_trained_on"),
    verification: verificationStatusEnum("verification").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("driver_operator_idx").on(table.operatorId)],
)

/**
 * §9's ComplianceCheck. One row per government-source lookup, kept even when
 * it fails — the verification queue shows the document beside the source's
 * answer, and "VAHAN said nothing" is itself the thing an ops person needs.
 */
export const complianceCheck = pgTable(
  "compliance_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    source: complianceSourceEnum("source").notNull(),
    passed: boolean("passed"),
    result: text("result"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("compliance_check_entity_idx").on(table.entityType, table.entityId)],
)

/* -------------------------------------------------------------------------
 * Demand: customers, trip requests, quotes
 * ---------------------------------------------------------------------- */

export const customer = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    /** §4.1: a corporate cannot expense a trip without this on the invoice. */
    gstin: text("gstin"),
    city: text("city"),
    segment: text("segment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("customer_phone_idx").on(table.phone)],
)

/** §8.6 DPDP consent ledger: purpose-limited, and withdrawable. */
export const consentRecord = pgTable(
  "consent_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id),
    purpose: text("purpose").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (table) => [index("consent_record_customer_idx").on(table.customerId)],
)

export const tripRequest = pgTable(
  "trip_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-quotable in a phone call: TOLI-R-000123. */
    reference: text("reference").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id),
    tripType: tripTypeEnum("trip_type").notNull(),
    city: text("city").notNull(),
    /**
     * The origin state. For passenger transport the place of supply is where
     * the passenger embarks, so this — not the destination — decides whether
     * the invoice carries CGST+SGST or IGST.
     */
    state: text("state").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    passengerCount: smallint("passenger_count").notNull(),
    vehicleClass: vehicleClassEnum("vehicle_class").notNull(),
    vehicleCount: smallint("vehicle_count").notNull().default(1),
    acRequired: boolean("ac_required").notNull().default(true),
    /** What the customer picked from the ladder. A better vehicle may serve it. */
    segment: segmentEnum("segment").notNull().default("premium"),
    /** A locale code the customer asked the driver to speak, if they asked. */
    preferredDriverLanguage: text("preferred_driver_language"),
    features: text("features").array().notNull().default([]),
    extras: text("extras").array().notNull().default([]),
    /** Drives the AITP requirement in domain/compliance.ts. */
    interstate: boolean("interstate").notNull().default(false),
    statesCrossed: text("states_crossed").array().notNull().default([]),
    estimatedKm: integer("estimated_km"),
    notes: text("notes"),
    status: tripRequestStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trip_request_reference_idx").on(table.reference),
    index("trip_request_status_idx").on(table.status),
    index("trip_request_start_idx").on(table.startAt),
  ],
)

export const stop = pgTable(
  "stop",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripRequestId: uuid("trip_request_id")
      .notNull()
      .references(() => tripRequest.id),
    sequence: smallint("sequence").notNull(),
    label: text("label").notNull(),
    /** Text, not float: coordinates come from a geocoder as decimal strings and
     * are only ever displayed or handed to a map link. */
    lat: text("lat"),
    lng: text("lng"),
    haltMinutes: integer("halt_minutes"),
  },
  (table) => [index("stop_trip_request_idx").on(table.tripRequestId)],
)

/**
 * §7.1's canonical quote schema, field for field.
 *
 * `min_km_per_day` and `state_permit_included` are the two the plan singles
 * out — the charges that turn a ₹28,000 quote into a ₹41,000 bill — so they
 * are columns, not a free-text remark, and the UI refuses to render a quote
 * without them.
 *
 * `estimated_total_paise` and `worst_case_total_paise` are stored, not
 * computed on read: §9 says every price shown to a user is snapshotted at
 * display time and a historical price is never recomputed.
 */
export const quote = pgTable(
  "quote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripRequestId: uuid("trip_request_id")
      .notNull()
      .references(() => tripRequest.id),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operator.id),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id),
    status: quoteStatusEnum("status").notNull().default("requested"),

    baseFarePaise: bigint("base_fare_paise", { mode: "number" }).notNull().default(0),
    includedKm: integer("included_km"),
    includedHours: integer("included_hours"),
    extraKmRatePaise: bigint("extra_km_rate_paise", { mode: "number" }),
    extraHourRatePaise: bigint("extra_hour_rate_paise", { mode: "number" }),
    perKmRatePaise: bigint("per_km_rate_paise", { mode: "number" }),
    minKmPerDay: integer("min_km_per_day"),
    driverBataPerDayPaise: bigint("driver_bata_per_day_paise", { mode: "number" })
      .notNull()
      .default(0),
    nightHaltPaise: bigint("night_halt_paise", { mode: "number" }).notNull().default(0),
    tollIncluded: boolean("toll_included").notNull().default(false),
    parkingIncluded: boolean("parking_included").notNull().default(false),
    statePermitIncluded: boolean("state_permit_included").notNull().default(false),
    fuelIncluded: boolean("fuel_included").notNull().default(true),
    gstTreatment: gstTreatmentEnum("gst_treatment").notNull(),

    /** Snapshotted at submission. Never recomputed. */
    estimatedTotalPaise: bigint("estimated_total_paise", { mode: "number" }).notNull().default(0),
    worstCaseTotalPaise: bigint("worst_case_total_paise", { mode: "number" }).notNull().default(0),

    days: smallint("days").notNull().default(1),
    nights: smallint("nights").notNull().default(0),
    cancellationPolicy: text("cancellation_policy"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    notes: text("notes"),

    /** The two timestamps §13's response-rate and time-to-first-quote metrics read. */
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (table) => [
    index("quote_trip_request_idx").on(table.tripRequestId),
    index("quote_operator_idx").on(table.operatorId),
  ],
)

/* -------------------------------------------------------------------------
 * Fulfilment: bookings, payments, assignment, execution
 * ---------------------------------------------------------------------- */

export const booking = pgTable(
  "booking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    tripRequestId: uuid("trip_request_id")
      .notNull()
      .references(() => tripRequest.id),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quote.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operator.id),
    status: bookingStatusEnum("status").notNull().default("confirmed"),
    source: bookingSourceEnum("source").notNull().default("quote"),

    /** Copied from the accepted quote so a later quote edit cannot rewrite history. */
    agreedTotalPaise: bigint("agreed_total_paise", { mode: "number" }).notNull(),
    advanceDuePaise: bigint("advance_due_paise", { mode: "number" }).notNull(),
    commissionBps: integer("commission_bps").notNull(),
    gstTreatment: gstTreatmentEnum("gst_treatment").notNull(),
    placeOfSupply: text("place_of_supply").notNull(),
    /** True when supplier and place of supply share a state: CGST+SGST, else IGST. */
    intraState: boolean("intra_state").notNull().default(true),

    /**
     * §4.1's shareable public tracking link — the one surface that works with
     * no app and no login. Unguessable, so it is the only credential that page has.
     */
    trackingToken: text("tracking_token").notNull(),

    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("booking_reference_idx").on(table.reference),
    uniqueIndex("booking_tracking_token_idx").on(table.trackingToken),
    index("booking_status_idx").on(table.status),
  ],
)

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    kind: paymentKindEnum("kind").notNull(),
    mode: paymentModeEnum("mode").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    gatewayRef: text("gateway_ref"),
    /** Which gateway, so a second one can be added without rewriting the first. */
    provider: text("provider"),
    /** The order a customer was sent to pay against, and the payment that resulted. */
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    /** The link handed to the customer, kept so it can be resent. */
    providerLinkUrl: text("provider_link_url"),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_booking_idx").on(table.bookingId)],
)

/**
 * §4.2: sub-contracting happens constantly in this market, so it is modelled
 * rather than denied. The sub-contracted operator must itself be on-platform,
 * which is why this is a foreign key and not a text field.
 */
export const assignment = pgTable(
  "assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicle.id),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => driver.id),
    subContractedToOperatorId: uuid("sub_contracted_to_operator_id").references(() => operator.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assignment_booking_idx").on(table.bookingId)],
)

export const tripEvent = pgTable(
  "trip_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    kind: tripEventKindEnum("kind").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    detail: text("detail"),
    odometerKm: integer("odometer_km"),
    lat: text("lat"),
    lng: text("lng"),
  },
  (table) => [index("trip_event_booking_idx").on(table.bookingId, table.at)],
)

/**
 * §6.3 keeps GPS history in Timescale at scale. Here it is an ordinary table:
 * the ops console needs the latest ping for the tracking page and the last few
 * for a dispute, and a hundred trips a month does not need a time-series store.
 * Retention (90 days, §6.3) is not implemented — see docs/ARCHITECTURE.md.
 */
export const locationPing = pgTable(
  "location_ping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    lat: text("lat").notNull(),
    lng: text("lng").notNull(),
    speedKmph: smallint("speed_kmph"),
    source: text("source").notNull().default("driver_app"),
  },
  (table) => [index("location_ping_booking_idx").on(table.bookingId, table.at)],
)

export const tripExpense = pgTable(
  "trip_expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    kind: expenseKindEnum("kind").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    receiptUrl: text("receipt_url"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trip_expense_booking_idx").on(table.bookingId)],
)

/* -------------------------------------------------------------------------
 * Money out: invoices, settlements
 * ---------------------------------------------------------------------- */

export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    number: text("number").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    /** Every component stored, because an invoice is a statement about a moment. */
    taxablePaise: bigint("taxable_paise", { mode: "number" }).notNull(),
    cgstPaise: bigint("cgst_paise", { mode: "number" }).notNull().default(0),
    sgstPaise: bigint("sgst_paise", { mode: "number" }).notNull().default(0),
    igstPaise: bigint("igst_paise", { mode: "number" }).notNull().default(0),
    totalPaise: bigint("total_paise", { mode: "number" }).notNull(),
    gstTreatment: gstTreatmentEnum("gst_treatment").notNull(),
    gstRateBps: integer("gst_rate_bps").notNull(),
    sacCode: text("sac_code").notNull(),
    placeOfSupply: text("place_of_supply").notNull(),
    customerGstin: text("customer_gstin"),
  },
  (table) => [
    uniqueIndex("invoice_number_idx").on(table.number),
    index("invoice_booking_idx").on(table.bookingId),
  ],
)

/**
 * §7.4 commission, §8.3's TCS (s.52 CGST) and TDS (s.194-O), plus the two
 * adjustments the plan insists are real: expenses the driver paid out of
 * pocket, and balance the driver took in cash — which the operator has
 * already been paid, so it comes off the transfer.
 */
export const settlement = pgTable(
  "settlement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    grossPaise: bigint("gross_paise", { mode: "number" }).notNull(),
    commissionPaise: bigint("commission_paise", { mode: "number" }).notNull(),
    tcsPaise: bigint("tcs_paise", { mode: "number" }).notNull(),
    tdsPaise: bigint("tds_paise", { mode: "number" }).notNull(),
    expensesReimbursedPaise: bigint("expenses_reimbursed_paise", { mode: "number" })
      .notNull()
      .default(0),
    cashCollectedPaise: bigint("cash_collected_paise", { mode: "number" }).notNull().default(0),
    netPayablePaise: bigint("net_payable_paise", { mode: "number" }).notNull(),
    status: settlementStatusEnum("status").notNull().default("pending"),
    utr: text("utr"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("settlement_booking_idx").on(table.bookingId)],
)

/* -------------------------------------------------------------------------
 * After the trip
 * ---------------------------------------------------------------------- */

/** §4.1's structured rating — four axes, because "3 stars" tells ops nothing. */
export const review = pgTable(
  "review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    cleanliness: smallint("cleanliness").notNull(),
    driverBehaviour: smallint("driver_behaviour").notNull(),
    punctuality: smallint("punctuality").notNull(),
    matchedBooking: smallint("matched_booking").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("review_booking_idx").on(table.bookingId)],
)

export const dispute = pgTable(
  "dispute",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id),
    kind: text("kind").notNull(),
    description: text("description").notNull(),
    status: disputeStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    refundPaise: bigint("refund_paise", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("dispute_booking_idx").on(table.bookingId)],
)

/**
 * Standing rates — what makes instant booking possible at all.
 *
 * §4.2 calls this "rate card mode": the operator sets a price per segment and
 * vehicle class once, and the platform quotes on their behalf. §11 then builds
 * Lane B on top of it. Without a rate card an operator can only answer RFQs by
 * hand, which is fine but caps how fast they can be booked.
 *
 * The columns are §7.1's, deliberately: an instant price and a hand-typed
 * quote must be the same shape, or the customer cannot compare them.
 */
export const rateCard = pgTable(
  "rate_card",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operator.id),
    segment: segmentEnum("segment").notNull(),
    vehicleClass: vehicleClassEnum("vehicle_class").notNull(),

    baseFarePaise: bigint("base_fare_paise", { mode: "number" }).notNull().default(0),
    perKmRatePaise: bigint("per_km_rate_paise", { mode: "number" }).notNull(),
    minKmPerDay: integer("min_km_per_day").notNull(),
    driverBataPerDayPaise: bigint("driver_bata_per_day_paise", { mode: "number" })
      .notNull()
      .default(0),
    nightHaltPaise: bigint("night_halt_paise", { mode: "number" }).notNull().default(0),
    /** Local packages: what the base fare covers before overage. */
    includedKm: integer("included_km"),
    includedHours: integer("included_hours"),
    extraKmRatePaise: bigint("extra_km_rate_paise", { mode: "number" }),
    extraHourRatePaise: bigint("extra_hour_rate_paise", { mode: "number" }),

    tollIncluded: boolean("toll_included").notNull().default(false),
    parkingIncluded: boolean("parking_included").notNull().default(false),
    statePermitIncluded: boolean("state_permit_included").notNull().default(false),

    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rate_card_unique_idx").on(table.operatorId, table.segment, table.vehicleClass),
    index("rate_card_lookup_idx").on(table.segment, table.vehicleClass),
  ],
)

export type RateCard = typeof rateCard.$inferSelect
export type Segment = (typeof segmentEnum.enumValues)[number]
export type BookingSource = (typeof bookingSourceEnum.enumValues)[number]

/**
 * One row, id `default`. Commission, the two statutory deduction rates, the
 * GST treatment in force and the advance percentage — the numbers §7.4 and
 * §8.3 say will change once a CA has answered, and which must therefore not
 * be constants in code.
 */
export const platformSetting = pgTable("platform_setting", {
  id: text("id").primaryKey(),
  defaultCommissionBps: integer("default_commission_bps").notNull().default(1000),
  tcsBps: integer("tcs_bps").notNull().default(100),
  tdsBps: integer("tds_bps").notNull().default(100),
  defaultGstTreatment: gstTreatmentEnum("default_gst_treatment")
    .notNull()
    .default("passenger_transport_5"),
  advanceBps: integer("advance_bps").notNull().default(2500),
  homeState: text("home_state").notNull().default("Tamil Nadu"),
  quoteValidityHours: integer("quote_validity_hours").notNull().default(48),
  /**
   * How a customer reaches Toli.
   *
   * Indian customers want to call somebody before parting with ₹16,000, and
   * §10's answer to disintermediation is not to hide from them — it is number
   * masking until a booking is confirmed. So Toli publishes its own number
   * everywhere, and the operator's is released once there is a booking to
   * discuss.
   */
  supportPhone: text("support_phone").notNull().default("+914522500100"),
  supportWhatsapp: text("support_whatsapp").notNull().default("+914522500100"),
  supportEmail: text("support_email").notNull().default("help@toli.in"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/* -------------------------------------------------------------------------
 * Integrations
 *
 * Four of the five external systems this app talks to need an account nobody
 * has yet — a gateway merchant account, a maps billing account, a WhatsApp
 * BSP, a VAHAN aggregator contract. The tables below are what those systems
 * write into, and they are deliberately provider-neutral: a `provider` column
 * rather than a `razorpay_` prefix, because §6.1's rule about never letting a
 * provider's types leak into the domain applies to columns too.
 * ---------------------------------------------------------------------- */

/**
 * A thing allowed to post GPS positions: a driver's phone, or an AIS-140 VLTD
 * box bolted to a vehicle.
 *
 * Only the SHA-256 of the token is stored. The plaintext is shown once, when
 * the device is enrolled, and never again — a leaked ingest token lets someone
 * forge a bus's location, which is worse than it sounds when the tracking link
 * is what a family is watching.
 */
export const ingestDeviceKindEnum = pgEnum("ingest_device_kind", ["driver_app", "vltd"])

export const ingestDevice = pgTable(
  "ingest_device",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: ingestDeviceKindEnum("kind").notNull(),
    label: text("label").notNull(),
    operatorId: uuid("operator_id").references(() => operator.id),
    /** A VLTD box belongs to one vehicle; a driver's phone moves between them. */
    vehicleId: uuid("vehicle_id").references(() => vehicle.id),
    driverId: uuid("driver_id").references(() => driver.id),
    /** The telematics vendor, for a VLTD device. Each speaks a different dialect. */
    vendor: text("vendor"),
    tokenHash: text("token_hash").notNull(),
    tokenLastFour: text("token_last_four").notNull(),
    active: boolean("active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ingest_device_token_idx").on(table.tokenHash),
    index("ingest_device_vehicle_idx").on(table.vehicleId),
  ],
)

/**
 * Geocoding and routing results, cached.
 *
 * §6.2 is the reason this table exists rather than a memory map: every RFQ
 * fans out to a dozen operators and every quote needs a distance, so the same
 * origin-destination pair is asked for hundreds of times. Geocodes are kept
 * forever; routes carry an expiry because roads and closures change.
 */
export const geoCache = pgTable(
  "geo_cache",
  {
    key: text("key").primaryKey(),
    kind: text("kind").notNull(),
    provider: text("provider").notNull(),
    payload: text("payload").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("geo_cache_expiry_idx").on(table.expiresAt)],
)

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
])

export const notificationChannelEnum = pgEnum("notification_channel", ["whatsapp", "sms"])

/**
 * The outbox. §4.5: WhatsApp is the primary channel, not push.
 *
 * Every message is a row before it is an API call, so a failed send is visible
 * rather than lost, and so "did the customer ever get the driver's details"
 * has an answer that does not involve asking the customer.
 */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => booking.id),
    channel: notificationChannelEnum("channel").notNull().default("whatsapp"),
    /** The registered template name — India requires pre-approval, for both DLT SMS and WhatsApp. */
    template: text("template").notNull(),
    toPhone: text("to_phone").notNull(),
    /** The rendered variables, kept so a delivered message can be reproduced. */
    payload: text("payload").notNull(),
    status: notificationStatusEnum("status").notNull().default("queued"),
    provider: text("provider"),
    providerRef: text("provider_ref"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("notification_booking_idx").on(table.bookingId),
    index("notification_status_idx").on(table.status),
  ],
)

/**
 * Every inbound webhook, stored before it is acted on.
 *
 * `provider_event_id` is unique, which is the whole point: gateways retry, and
 * a retried payment-captured event must not record the payment twice. It is
 * also the only durable record of what a provider actually sent when their
 * dashboard and this database disagree.
 */
export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    kind: text("kind").notNull(),
    payload: text("payload").notNull(),
    signatureValid: boolean("signature_valid").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => [
    uniqueIndex("webhook_event_provider_id_idx").on(table.provider, table.providerEventId),
    index("webhook_event_received_idx").on(table.receivedAt),
  ],
)

/* -------------------------------------------------------------------------
 * People who sign in
 *
 * §3 names five surfaces and insists the driver is a distinct user from the
 * operator — merge them and either the driver learns the take rate, or the
 * operator's app is crippled by background location permissions. So a role is
 * not a flag on one account; it decides which application a person even sees.
 *
 * This replaces the template's single-operator gate, which was one email and
 * one password hash in the environment. That environment identity survives as
 * break-glass access only: if this table is empty or unreachable, the operator
 * can still get in and fix it.
 * ---------------------------------------------------------------------- */

export const roleEnum = pgEnum("app_role", ["admin", "customer", "operator", "driver"])

export const appUser = pgTable(
  "app_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: roleEnum("role").notNull(),
    /** scrypt, in the same encoding the template's password helper produces. */
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),

    /**
     * What this person is, on the other side of the app.
     *
     * An operator user is an operator; a driver user is a driver; a customer
     * user is a customer. Exactly one of these is set, enforced in code rather
     * than by a check constraint so the message can explain itself.
     */
    operatorId: uuid("operator_id").references(() => operator.id),
    driverId: uuid("driver_id").references(() => driver.id),
    customerId: uuid("customer_id").references(() => customer.id),

    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Addresses are always stored lower-cased, so a unique index is also a
    // case-insensitive one — and sign-in stays a single indexed lookup.
    uniqueIndex("app_user_email_idx").on(table.email),
    index("app_user_role_idx").on(table.role),
  ],
)

export type AppUser = typeof appUser.$inferSelect
export type AppRole = (typeof roleEnum.enumValues)[number]

/**
 * Photographs of a vehicle.
 *
 * §4.1 is specific: "vehicle photos (real ones, uploaded and verified — not
 * stock images)", and §10 lists a customer arriving to a different vehicle as
 * a catastrophe rather than a bad rating. So a photo belongs to a vehicle, is
 * labelled by what it shows, and carries the same verification state a
 * document does — an unverified photo is a claim, not evidence.
 *
 * The image itself lives in object storage; this row holds where. When object
 * storage is not configured, an operator can still record a link to a photo
 * they host elsewhere, which is worth more than an empty gallery.
 */
export const photoKindEnum = pgEnum("photo_kind", [
  "exterior",
  "interior",
  "seats",
  "boot",
  "documents",
])

export const vehiclePhoto = pgTable(
  "vehicle_photo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicle.id),
    kind: photoKindEnum("kind").notNull().default("exterior"),
    url: text("url").notNull(),
    /** The object-storage key, when Toli hosts it — null for a linked image. */
    storageKey: text("storage_key"),
    caption: text("caption"),
    verification: verificationStatusEnum("verification").notNull().default("pending"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("vehicle_photo_vehicle_idx").on(table.vehicleId)],
)

export type VehiclePhoto = typeof vehiclePhoto.$inferSelect

export type IngestDevice = typeof ingestDevice.$inferSelect
export type GeoCache = typeof geoCache.$inferSelect
export type Notification = typeof notification.$inferSelect
export type WebhookEvent = typeof webhookEvent.$inferSelect

export type Operator = typeof operator.$inferSelect
export type Vehicle = typeof vehicle.$inferSelect
export type VehicleDocument = typeof vehicleDocument.$inferSelect
export type Driver = typeof driver.$inferSelect
export type Customer = typeof customer.$inferSelect
export type TripRequest = typeof tripRequest.$inferSelect
export type Stop = typeof stop.$inferSelect
export type Quote = typeof quote.$inferSelect
export type Booking = typeof booking.$inferSelect
export type Payment = typeof payment.$inferSelect
export type Assignment = typeof assignment.$inferSelect
export type TripEvent = typeof tripEvent.$inferSelect
export type LocationPing = typeof locationPing.$inferSelect
export type TripExpense = typeof tripExpense.$inferSelect
export type Invoice = typeof invoice.$inferSelect
export type Settlement = typeof settlement.$inferSelect
export type Review = typeof review.$inferSelect
export type Dispute = typeof dispute.$inferSelect
export type PlatformSetting = typeof platformSetting.$inferSelect
export type VehicleClass = (typeof vehicleClassEnum.enumValues)[number]
export type VehicleStatus = (typeof vehicleStatusEnum.enumValues)[number]
export type DocumentKind = (typeof documentKindEnum.enumValues)[number]
export type TripType = (typeof tripTypeEnum.enumValues)[number]
export type GstTreatment = (typeof gstTreatmentEnum.enumValues)[number]
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number]
