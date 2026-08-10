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
  homeState: text("home_state").notNull().default("Rajasthan"),
  quoteValidityHours: integer("quote_validity_hours").notNull().default(48),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

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
