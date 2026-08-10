import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * Append-only record of things worth knowing after the fact: sign-ins,
 * failed sign-ins, and whatever the app built on this template adds.
 *
 * A single-operator app has no admin console, so this table is the only
 * place a past event is recoverable from.
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

/**
 * Money is stored in paise, as integers, everywhere below this line.
 *
 * Rupee floats accumulate error the moment a commission percentage touches
 * them, and a charter quote is a sum of six components before anyone has
 * agreed to anything. Forms take rupees and convert on the way in; nothing
 * here ever holds a fractional amount.
 */

/**
 * A fleet business: four to thirty vehicles, an owner and a dispatcher,
 * currently taking bookings on WhatsApp. Not a gig driver, and not a user —
 * no operator signs in here, because the gate has room for exactly one
 * identity. The desk records them on their behalf.
 */
export const operators = pgTable(
  "operator",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone").notNull(),
    city: text("city").notNull(),
    gstin: text("gstin"),
    /** Verified means someone actually looked at the permit, the fitness
     * certificate and at least one vehicle. Unverified operators can still be
     * quoted against; the desk always sees which is which. */
    verified: boolean("verified").notNull().default(false),
    /** Basis points, so 1000 is 10%. Per operator rather than one global
     * number: the pitch to supply is "less than the agent's 15–25%", and
     * whatever a given operator was promised has to survive the conversation. */
    commissionBps: integer("commission_bps").notNull().default(1000),
    notes: text("notes"),
  },
  (table) => [index("operator_city_idx").on(table.city)],
)

/** A vehicle in an operator's fleet. Class and capacity are what matching
 * needs; the registration is what the customer is told at 4 AM. */
export const vehicles = pgTable(
  "vehicle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    seats: integer("seats").notNull(),
    registration: text("registration").notNull(),
    modelYear: integer("model_year"),
    ac: boolean("ac").notNull().default(true),
    active: boolean("active").notNull().default(true),
  },
  (table) => [index("vehicle_operator_idx").on(table.operatorId)],
)

/**
 * A charter requirement — the RFQ. The whole vehicle, for a duration, with a
 * driver who stays with the group. Never a seat.
 *
 * `reference` is a serial rather than the uuid because this number gets read
 * aloud down a phone line to a dispatcher in Jaipur.
 */
export const charterRequests = pgTable(
  "charter_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reference: serial("reference").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    /** wedding | corporate | pilgrimage | school | employee */
    segment: text("segment").notNull(),
    fromCity: text("from_city").notNull(),
    itinerary: text("itinerary").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    passengers: integer("passengers").notNull(),
    vehicleKind: text("vehicle_kind").notNull(),
    vehiclesNeeded: integer("vehicles_needed").notNull().default(1),
    /** The desk's estimate of running kilometres for the whole trip. Every
     * quote is normalised against this one number, which is what makes two
     * quotes with different included-km allowances comparable at all. */
    estimatedKm: integer("estimated_km").notNull(),
    /** open | awarded | cancelled */
    status: text("status").notNull().default("open"),
    notes: text("notes"),
  },
  (table) => [
    index("charter_request_status_idx").on(table.status),
    index("charter_request_start_idx").on(table.startDate),
  ],
)

/**
 * An operator's structured answer to a requirement.
 *
 * The components are itemised deliberately: base, per-km beyond an included
 * allowance, driver bata per day, night halt per night, and the three that
 * get left out of a spoken price — tolls, parking, and the interstate permit.
 * A quote that excludes those is not cheaper, it is less complete, and Toli
 * Fair Price exists to say so before the money moves rather than after.
 */
export const quotes = pgTable(
  "quote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => charterRequests.id, { onDelete: "cascade" }),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    vehicleKind: text("vehicle_kind").notNull(),
    seats: integer("seats").notNull(),
    baseFarePaise: integer("base_fare_paise").notNull(),
    includedKm: integer("included_km").notNull(),
    perKmPaise: integer("per_km_paise").notNull(),
    driverBataPaise: integer("driver_bata_paise").notNull().default(0),
    nightHaltPaise: integer("night_halt_paise").notNull().default(0),
    tollsIncluded: boolean("tolls_included").notNull().default(false),
    tollsPaise: integer("tolls_paise").notNull().default(0),
    parkingIncluded: boolean("parking_included").notNull().default(false),
    parkingPaise: integer("parking_paise").notNull().default(0),
    permitIncluded: boolean("permit_included").notNull().default(false),
    permitPaise: integer("permit_paise").notNull().default(0),
    notes: text("notes"),
    /** submitted | awarded | declined */
    status: text("status").notNull().default("submitted"),
  },
  (table) => [index("quote_request_idx").on(table.requestId)],
)

/**
 * An awarded quote, with the numbers frozen at the moment of the award.
 *
 * The totals are copied rather than recomputed from the quote on read: a
 * booking is what was agreed, and a later change to how pricing is calculated
 * must not silently restate a trip somebody has already paid an advance on.
 */
export const bookings = pgTable(
  "booking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => charterRequests.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    allInPaise: integer("all_in_paise").notNull(),
    advancePaise: integer("advance_paise").notNull(),
    commissionPaise: integer("commission_paise").notNull(),
    /** confirmed | completed | cancelled */
    status: text("status").notNull().default("confirmed"),
  },
  // One booking per requirement: awarding twice is a mistake, not a feature.
  (table) => [uniqueIndex("booking_request_key").on(table.requestId)],
)

export type OperatorRow = typeof operators.$inferSelect
export type VehicleRow = typeof vehicles.$inferSelect
export type CharterRequestRow = typeof charterRequests.$inferSelect
export type QuoteRow = typeof quotes.$inferSelect
export type BookingRow = typeof bookings.$inferSelect
