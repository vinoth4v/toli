import { relations } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import type { TripType } from "@/domain/pricing"
import type {
  BookingStatus,
  EnquiryStatus,
  OperatorStatus,
  PaymentKind,
  PaymentMethod,
  QuoteStatus,
} from "@/domain/status"
import type { PermitType, VehicleClass } from "@/domain/vehicles"

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

/**
 * A transport company with vehicles to charter — the supply side.
 *
 * Named `transport_operator` rather than `operator`: "the operator" in this
 * codebase already means the single human who signs in, and a table that reads
 * one way in SQL and another way in prose is a bug waiting for a tired hour.
 *
 * Status is what the marketplace is actually selling (§1). An unverified
 * company can be recorded, but `canQuote` will not let a customer be shown it.
 */
export const transportOperator = pgTable(
  "transport_operator",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    contactName: text("contact_name").notNull(),
    phone: text("phone").notNull(),
    /** 15-character GSTIN. Null until collected — onboarding beats completeness. */
    gstin: text("gstin"),
    status: text("status").$type<OperatorStatus>().notNull().default("pending"),
    /** Take rate for this operator, negotiable per deal, in basis points. */
    commissionBps: integer("commission_bps").notNull().default(1200),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transport_operator_status_idx").on(table.status)],
)

/**
 * One chartered vehicle.
 *
 * `per_km_paise` is nullable on purpose: most vehicles are quoted from the
 * class rate card, and only an operator who has negotiated their own rate
 * carries one. A null means "use the card", not "free".
 */
export const vehicle = pgTable(
  "vehicle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => transportOperator.id, { onDelete: "cascade" }),
    registration: text("registration").notNull(),
    class: text("class").$type<VehicleClass>().notNull(),
    seats: integer("seats").notNull(),
    model: text("model"),
    ac: boolean("ac").notNull().default(true),
    permitType: text("permit_type").$type<PermitType>().notNull(),
    /** Date only — a permit expires on a day, not at an instant. */
    permitExpiry: date("permit_expiry", { mode: "string" }),
    perKmPaise: integer("per_km_paise"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A registration number is unique across India, so a duplicate is either a
    // typo or the same vehicle listed by two operators — both worth refusing.
    uniqueIndex("vehicle_registration_idx").on(table.registration),
    index("vehicle_operator_idx").on(table.operatorId),
  ],
)

/** A group asking to be moved: the demand side, before anyone has priced it. */
export const enquiry = pgTable(
  "enquiry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ref: text("ref").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    tripType: text("trip_type").$type<TripType>().notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    days: integer("days").notNull().default(1),
    passengers: integer("passengers").notNull(),
    /**
     * Distance as entered by whoever took the enquiry. A routing API would
     * fill this instead (§6), and deliberately does not yet — see Known gaps.
     */
    estimatedKm: integer("estimated_km").notNull(),
    vehicleClass: text("vehicle_class").$type<VehicleClass>().notNull(),
    status: text("status").$type<EnquiryStatus>().notNull().default("new"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("enquiry_ref_idx").on(table.ref),
    index("enquiry_status_idx").on(table.status),
    index("enquiry_start_at_idx").on(table.startAt),
  ],
)

/**
 * A price offered by one operator for one enquiry.
 *
 * Every component of the fare is stored, not just the total, and the quote is
 * never recomputed after it is sent. Rate cards move; a price a customer was
 * given must still be explainable line by line six months later, when the card
 * it came from no longer exists.
 */
export const quote = pgTable(
  "quote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enquiryId: uuid("enquiry_id")
      .notNull()
      .references(() => enquiry.id, { onDelete: "cascade" }),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => transportOperator.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id, { onDelete: "set null" }),
    perKmPaise: integer("per_km_paise").notNull(),
    chargeableKm: integer("chargeable_km").notNull(),
    baseFarePaise: integer("base_fare_paise").notNull(),
    driverAllowancePaise: integer("driver_allowance_paise").notNull(),
    nightHaltPaise: integer("night_halt_paise").notNull(),
    tollsParkingPaise: integer("tolls_parking_paise").notNull(),
    subtotalPaise: integer("subtotal_paise").notNull(),
    gstRateBps: integer("gst_rate_bps").notNull(),
    gstPaise: integer("gst_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    commissionBps: integer("commission_bps").notNull(),
    commissionPaise: integer("commission_paise").notNull(),
    operatorPayoutPaise: integer("operator_payout_paise").notNull(),
    status: text("status").$type<QuoteStatus>().notNull().default("draft"),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quote_enquiry_idx").on(table.enquiryId),
    index("quote_status_idx").on(table.status),
  ],
)

/**
 * An accepted quote, and the trip it became.
 *
 * One booking per quote — the unique index is what stops a double-click on
 * "accept" from confirming the same vehicle to the same group twice.
 */
export const booking = pgTable(
  "booking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ref: text("ref").notNull(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quote.id, { onDelete: "restrict" }),
    enquiryId: uuid("enquiry_id")
      .notNull()
      .references(() => enquiry.id, { onDelete: "restrict" }),
    status: text("status").$type<BookingStatus>().notNull().default("confirmed"),
    /** Assigned close to departure, so all three are null on a fresh booking. */
    driverName: text("driver_name"),
    driverPhone: text("driver_phone"),
    vehicleRegistration: text("vehicle_registration"),
    pickupNote: text("pickup_note"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
  },
  (table) => [
    uniqueIndex("booking_ref_idx").on(table.ref),
    uniqueIndex("booking_quote_idx").on(table.quoteId),
    index("booking_status_idx").on(table.status),
  ],
)

/**
 * Money that actually moved (§8), as a ledger rather than a balance.
 *
 * Balances are derived by summing this table. Storing "amount paid" on the
 * booking instead would be smaller and would lose the one thing a payment
 * dispute needs: when each rupee arrived, by what method, and against which
 * reference.
 */
export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    kind: text("kind").$type<PaymentKind>().notNull(),
    amountPaise: integer("amount_paise").notNull(),
    method: text("method").$type<PaymentMethod>().notNull(),
    /** UTR, UPI reference, or whatever the rail gave back. */
    reference: text("reference"),
    note: text("note"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_booking_idx").on(table.bookingId)],
)

export const transportOperatorRelations = relations(transportOperator, ({ many }) => ({
  vehicles: many(vehicle),
  quotes: many(quote),
}))

export const vehicleRelations = relations(vehicle, ({ one }) => ({
  operator: one(transportOperator, {
    fields: [vehicle.operatorId],
    references: [transportOperator.id],
  }),
}))

export const enquiryRelations = relations(enquiry, ({ many }) => ({
  quotes: many(quote),
}))

export const quoteRelations = relations(quote, ({ one }) => ({
  enquiry: one(enquiry, { fields: [quote.enquiryId], references: [enquiry.id] }),
  operator: one(transportOperator, {
    fields: [quote.operatorId],
    references: [transportOperator.id],
  }),
  vehicle: one(vehicle, { fields: [quote.vehicleId], references: [vehicle.id] }),
}))

export const bookingRelations = relations(booking, ({ one, many }) => ({
  quote: one(quote, { fields: [booking.quoteId], references: [quote.id] }),
  enquiry: one(enquiry, { fields: [booking.enquiryId], references: [enquiry.id] }),
  payments: many(payment),
}))

export const paymentRelations = relations(payment, ({ one }) => ({
  booking: one(booking, { fields: [payment.bookingId], references: [booking.id] }),
}))

export type AuditLogRow = typeof auditLog.$inferSelect
export type NewAuditLogRow = typeof auditLog.$inferInsert
export type TransportOperatorRow = typeof transportOperator.$inferSelect
export type VehicleRow = typeof vehicle.$inferSelect
export type EnquiryRow = typeof enquiry.$inferSelect
export type QuoteRow = typeof quote.$inferSelect
export type BookingRow = typeof booking.$inferSelect
export type PaymentRow = typeof payment.$inferSelect
