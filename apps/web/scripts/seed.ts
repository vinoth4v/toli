/**
 * Seeds a development or staging database with realistic Jaipur data.
 *
 * §5.3 of the build plan is specific about this: seed staging with realistic
 * Indian data, not `John Doe`. So the operators are the kind of firm that
 * actually runs tempo travellers out of Sindhi Camp, the registrations are
 * real RJ series, the routes are the ones that get chartered — Jaipur to
 * Ajmer for a pilgrimage, Jaipur to Agra across the Uttar Pradesh border for
 * a wedding party — and the prices are what those trips cost.
 *
 * Refuses to run against a database that already has operators, so it cannot
 * quietly double a fleet. Never run it against production.
 *
 *   DATABASE_URL=... pnpm --filter web run db:seed
 */

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../src/db/schema.ts"
import { trackingToken } from "../src/domain/format.ts"
import { extractGstFromGross } from "../src/domain/gst.ts"
import { applyBps } from "../src/domain/money.ts"
import { priceQuote, type QuoteTerms } from "../src/domain/quote.ts"
import { computeSettlement } from "../src/domain/settlement.ts"
import { tripDuration } from "../src/domain/trip.ts"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set. See apps/web/.env.example.")
  process.exit(1)
}

const db = drizzle(neon(url), { schema })

const DAY = 86_400_000
const now = Date.now()
const day = (offset: number, hour = 6, minute = 0) =>
  new Date(now + offset * DAY - (now % DAY) + (hour - 5.5) * 3_600_000 + minute * 60_000)
const isoDate = (offset: number) => new Date(now + offset * DAY).toISOString().slice(0, 10)

async function main(): Promise<void> {
  const existing = await db.select({ id: schema.operator.id }).from(schema.operator).limit(1)
  if (existing.length > 0) {
    console.error("This database already has operators. Seeding would duplicate them — stopping.")
    process.exit(1)
  }

  await db.insert(schema.platformSetting).values({ id: "default" }).onConflictDoNothing()

  const operators = await db
    .insert(schema.operator)
    .values([
      {
        name: "Shekhawati Travels",
        city: "Jaipur",
        contactName: "Mahendra Singh",
        phone: "+919829011234",
        email: "ops@shekhawatitravels.in",
        pan: "AAECS1234F",
        gstin: "08AAECS1234F1ZO",
        status: "active",
        tier: "gold",
        commissionBps: 900,
        bankAccountLast4: "4417",
        notes: "First operator signed. Runs the Ajmer–Pushkar circuit weekly; very responsive.",
      },
      {
        name: "Pink City Coach Service",
        city: "Jaipur",
        contactName: "Rekha Sharma",
        phone: "+919314055678",
        email: "bookings@pinkcitycoach.com",
        pan: "AAFCP5678K",
        gstin: "08AAFCP5678K1ZR",
        status: "active",
        tier: "silver",
        bankAccountLast4: "9082",
        notes: "Volvo multi-axle and 45-seat coaches. Strong on corporate offsites.",
      },
      {
        name: "Rajputana Fleet Owners",
        city: "Jaipur",
        contactName: "Imran Qureshi",
        phone: "+919928099887",
        status: "pending_verification",
        tier: "bronze",
        notes: "Nine tempo travellers. Paperwork still coming in.",
      },
    ])
    .returning()

  const [shekhawati, pinkCity, rajputana] = operators
  if (!shekhawati || !pinkCity || !rajputana) throw new Error("operators not created")

  const vehicles = await db
    .insert(schema.vehicle)
    .values([
      {
        operatorId: shekhawati.id,
        registrationNumber: "RJ 14 PA 4521",
        vehicleClass: "tempo_traveller",
        seats: 17,
        ac: true,
        yearOfManufacture: 2022,
        fuelType: "diesel",
        features: ["pushback", "luggage_carrier", "led_tv"],
        photoCount: 8,
        status: "active",
      },
      {
        operatorId: shekhawati.id,
        registrationNumber: "RJ 14 PB 8890",
        vehicleClass: "tempo_traveller",
        seats: 26,
        ac: true,
        yearOfManufacture: 2020,
        fuelType: "diesel",
        features: ["pushback", "luggage_carrier", "mic"],
        photoCount: 6,
        status: "active",
      },
      {
        operatorId: pinkCity.id,
        registrationNumber: "RJ 14 PC 1207",
        vehicleClass: "coach_seater",
        seats: 45,
        ac: true,
        yearOfManufacture: 2021,
        fuelType: "diesel",
        features: ["pushback", "mic", "led_tv", "luggage_carrier"],
        photoCount: 10,
        status: "active",
      },
      {
        // Insurance lapsed last week: the compliance queue has to have
        // something real in it, because that screen is the one that must work.
        operatorId: pinkCity.id,
        registrationNumber: "RJ 14 PC 3388",
        vehicleClass: "mini_bus",
        seats: 32,
        ac: false,
        yearOfManufacture: 2016,
        fuelType: "diesel",
        features: ["luggage_carrier"],
        photoCount: 4,
        status: "active",
      },
      {
        operatorId: rajputana.id,
        registrationNumber: "RJ 45 CA 7761",
        vehicleClass: "tempo_traveller",
        seats: 13,
        ac: true,
        yearOfManufacture: 2019,
        fuelType: "diesel",
        features: ["pushback"],
        photoCount: 2,
        status: "pending_verification",
      },
    ])
    .returning()

  const [tt17, tt26, coach45, miniBus, ttPending] = vehicles
  if (!tt17 || !tt26 || !coach45 || !miniBus || !ttPending) throw new Error("vehicles not created")

  const inDate = (vehicleId: string, aitp: string | null) => [
    {
      vehicleId,
      kind: "rc" as const,
      number: "RC-2216654",
      expiresOn: isoDate(2200),
      verification: "verified" as const,
    },
    {
      vehicleId,
      kind: "fitness" as const,
      number: "FC-8871",
      expiresOn: isoDate(400),
      verification: "verified" as const,
    },
    {
      vehicleId,
      kind: "insurance" as const,
      number: "POL-99231",
      expiresOn: isoDate(210),
      verification: "verified" as const,
    },
    {
      vehicleId,
      kind: "puc" as const,
      number: "PUC-4410",
      expiresOn: isoDate(120),
      verification: "verified" as const,
    },
    {
      vehicleId,
      kind: "vltd" as const,
      number: "AIS140-7723",
      expiresOn: isoDate(900),
      verification: "verified" as const,
    },
    ...(aitp
      ? [
          {
            vehicleId,
            kind: "aitp" as const,
            number: aitp,
            expiresOn: isoDate(300),
            verification: "verified" as const,
          },
        ]
      : []),
  ]

  await db.insert(schema.vehicleDocument).values([
    ...inDate(tt17.id, "AITP-RJ-88121"),
    ...inDate(tt26.id, "AITP-RJ-88122"),
    ...inDate(coach45.id, "AITP-RJ-90441"),
    // Mini bus: insurance expired a week ago, and its permit expires in nine
    // days. One blocking row and one warning row, which is what the queue is for.
    {
      vehicleId: miniBus.id,
      kind: "rc",
      number: "RC-3390012",
      expiresOn: isoDate(1800),
      verification: "verified",
    },
    {
      vehicleId: miniBus.id,
      kind: "fitness",
      number: "FC-2201",
      expiresOn: isoDate(9),
      verification: "verified",
    },
    {
      vehicleId: miniBus.id,
      kind: "insurance",
      number: "POL-33110",
      expiresOn: isoDate(-7),
      verification: "verified",
    },
    {
      vehicleId: miniBus.id,
      kind: "puc",
      number: "PUC-9902",
      expiresOn: isoDate(60),
      verification: "verified",
    },
    {
      vehicleId: miniBus.id,
      kind: "vltd",
      number: "AIS140-3311",
      expiresOn: isoDate(500),
      verification: "verified",
    },
    // Pending operator: documents uploaded, nobody has checked them yet.
    {
      vehicleId: ttPending.id,
      kind: "rc",
      number: "RC-7761223",
      expiresOn: isoDate(1500),
      verification: "pending",
    },
    {
      vehicleId: ttPending.id,
      kind: "insurance",
      number: "POL-77612",
      expiresOn: isoDate(180),
      verification: "pending",
    },
    {
      vehicleId: ttPending.id,
      kind: "fitness",
      number: "FC-7761",
      expiresOn: isoDate(240),
      verification: "pending",
    },
  ])

  const drivers = await db
    .insert(schema.driver)
    .values([
      {
        operatorId: shekhawati.id,
        name: "Ramesh Meena",
        phone: "+919829445566",
        dlNumber: "RJ1420110004421",
        dlExpiresOn: isoDate(700),
        policeVerifiedOn: isoDate(-120),
        medicalCheckedOn: isoDate(-90),
        inductionTrainedOn: isoDate(-88),
        verification: "verified",
      },
      {
        operatorId: shekhawati.id,
        name: "Sohan Lal Gurjar",
        phone: "+919887332211",
        dlNumber: "RJ1420090011872",
        dlExpiresOn: isoDate(22),
        policeVerifiedOn: isoDate(-200),
        medicalCheckedOn: isoDate(-150),
        inductionTrainedOn: isoDate(-149),
        verification: "verified",
      },
      {
        operatorId: pinkCity.id,
        name: "Abdul Rehman",
        phone: "+919314778899",
        dlNumber: "RJ1420150003310",
        dlExpiresOn: isoDate(900),
        policeVerifiedOn: isoDate(-60),
        medicalCheckedOn: isoDate(-60),
        inductionTrainedOn: isoDate(-59),
        verification: "verified",
      },
    ])
    .returning()

  const [ramesh, , abdul] = drivers
  if (!ramesh || !abdul) throw new Error("drivers not created")

  const customers = await db
    .insert(schema.customer)
    .values([
      {
        name: "Aditi Agarwal",
        phone: "+919001122334",
        email: "aditi.agarwal@gmail.com",
        city: "Jaipur",
        segment: "wedding",
      },
      {
        name: "Nexworth Analytics Pvt Ltd",
        phone: "+919833004455",
        email: "admin@nexworth.in",
        gstin: "27AAGCN9911L1ZY",
        city: "Mumbai",
        segment: "corporate",
      },
      {
        name: "Shri Ramdev Yatra Mandal",
        phone: "+919772211009",
        city: "Jaipur",
        segment: "pilgrimage",
      },
    ])
    .returning()

  const [aditi, nexworth, yatra] = customers
  if (!aditi || !nexworth || !yatra) throw new Error("customers not created")

  await db.insert(schema.consentRecord).values([
    { customerId: aditi.id, purpose: "trip_booking_and_tracking" },
    { customerId: nexworth.id, purpose: "trip_booking_and_tracking" },
    { customerId: nexworth.id, purpose: "marketing_whatsapp" },
    { customerId: yatra.id, purpose: "trip_booking_and_tracking" },
  ])

  const requests = await db
    .insert(schema.tripRequest)
    .values([
      {
        reference: "TOLI-R-000001",
        customerId: aditi.id,
        tripType: "round_trip",
        city: "Jaipur",
        state: "Rajasthan",
        startAt: day(-9, 6),
        endAt: day(-8, 21),
        passengerCount: 24,
        vehicleClass: "tempo_traveller",
        vehicleCount: 1,
        acRequired: true,
        features: ["pushback", "luggage_carrier"],
        extras: ["decorated_vehicle", "guest_tracking_link"],
        interstate: true,
        statesCrossed: ["Uttar Pradesh"],
        estimatedKm: 480,
        notes:
          "Baraat from Jaipur to Agra, back next evening. Decorated vehicle, driver in uniform.",
        status: "booked",
        createdAt: new Date(now - 14 * DAY),
      },
      {
        reference: "TOLI-R-000002",
        customerId: nexworth.id,
        tripType: "multi_day_tour",
        city: "Jaipur",
        state: "Rajasthan",
        startAt: day(6, 7),
        endAt: day(8, 19),
        passengerCount: 42,
        vehicleClass: "coach_seater",
        vehicleCount: 1,
        acRequired: true,
        features: ["pushback", "mic", "led_tv"],
        extras: ["first_aid", "guest_tracking_link"],
        interstate: false,
        statesCrossed: [],
        estimatedKm: 620,
        notes:
          "Sales offsite — Jaipur, Ranthambore, Jaipur. GST invoice required against Mumbai GSTIN.",
        status: "quoting",
        createdAt: new Date(now - 2 * DAY),
      },
      {
        reference: "TOLI-R-000003",
        customerId: yatra.id,
        tripType: "round_trip",
        city: "Jaipur",
        state: "Rajasthan",
        startAt: day(12, 5),
        endAt: day(12, 22),
        passengerCount: 16,
        vehicleClass: "tempo_traveller",
        vehicleCount: 1,
        acRequired: false,
        features: ["luggage_carrier"],
        extras: [],
        interstate: false,
        statesCrossed: [],
        estimatedKm: 290,
        notes:
          "Ajmer Sharif and Pushkar, one day. Elderly group — needs a low step and unhurried stops.",
        status: "open",
        createdAt: new Date(now - 4 * 3_600_000),
      },
    ])
    .returning()

  const [wedding, offsite, pilgrimage] = requests
  if (!wedding || !offsite || !pilgrimage) throw new Error("requests not created")

  await db.insert(schema.stop).values([
    { tripRequestId: wedding.id, sequence: 0, label: "Hotel Clarks Amer, Jaipur" },
    { tripRequestId: wedding.id, sequence: 1, label: "Fatehpur Sikri" },
    { tripRequestId: wedding.id, sequence: 2, label: "Taj East Gate, Agra" },
    { tripRequestId: offsite.id, sequence: 0, label: "Nexworth office, Malviya Nagar" },
    { tripRequestId: offsite.id, sequence: 1, label: "Ranthambore National Park" },
    { tripRequestId: offsite.id, sequence: 2, label: "Nexworth office, Malviya Nagar" },
    { tripRequestId: pilgrimage.id, sequence: 0, label: "Sanganeri Gate, Jaipur" },
    { tripRequestId: pilgrimage.id, sequence: 1, label: "Ajmer Sharif Dargah" },
    { tripRequestId: pilgrimage.id, sequence: 2, label: "Pushkar" },
  ])

  /** Prices a quote the way the app does, so seeded totals are not invented. */
  function quoteValues(input: {
    requestId: string
    operatorId: string
    vehicleId: string | null
    request: schema.TripRequest
    terms: QuoteTerms
    requestedAt: Date
    submittedAt: Date | null
    status: "requested" | "submitted" | "accepted" | "rejected"
  }) {
    const { days, nights } = tripDuration(input.request.startAt, input.request.endAt)
    const estimatedKm = input.request.estimatedKm ?? 0
    const priced = priceQuote(input.terms, {
      tripType: input.request.tripType,
      days,
      nights,
      estimatedKm,
      estimatedHours: Math.max(days * 8, Math.round(estimatedKm / 35)),
      interstate: input.request.interstate,
      stateCount: input.request.statesCrossed.length,
    })

    return {
      tripRequestId: input.requestId,
      operatorId: input.operatorId,
      vehicleId: input.vehicleId,
      status: input.status,
      ...input.terms,
      days,
      nights,
      estimatedTotalPaise: input.submittedAt ? priced.estimatedTotalPaise : 0,
      worstCaseTotalPaise: input.submittedAt ? priced.worstCaseTotalPaise : 0,
      requestedAt: input.requestedAt,
      submittedAt: input.submittedAt,
      validUntil: input.submittedAt ? new Date(input.submittedAt.getTime() + 2 * DAY) : null,
    }
  }

  const outstation = (over: Partial<QuoteTerms> = {}): QuoteTerms => ({
    baseFarePaise: 0,
    includedKm: null,
    includedHours: null,
    extraKmRatePaise: null,
    extraHourRatePaise: null,
    perKmRatePaise: 2_200,
    minKmPerDay: 300,
    driverBataPerDayPaise: 50_000,
    nightHaltPaise: 40_000,
    tollIncluded: true,
    parkingIncluded: false,
    statePermitIncluded: false,
    fuelIncluded: true,
    gstTreatment: "passenger_transport_5",
    ...over,
  })

  const askedAt = new Date(now - 14 * DAY + 20 * 60_000)

  const quotes = await db
    .insert(schema.quote)
    .values([
      quoteValues({
        requestId: wedding.id,
        operatorId: shekhawati.id,
        vehicleId: tt26.id,
        request: wedding,
        terms: outstation({ perKmRatePaise: 2_300, statePermitIncluded: true }),
        requestedAt: askedAt,
        submittedAt: new Date(askedAt.getTime() + 7 * 60_000),
        status: "accepted",
      }),
      quoteValues({
        requestId: wedding.id,
        operatorId: pinkCity.id,
        vehicleId: null,
        request: wedding,
        terms: outstation({ perKmRatePaise: 2_100, minKmPerDay: 350 }),
        requestedAt: askedAt,
        submittedAt: new Date(askedAt.getTime() + 19 * 60_000),
        status: "rejected",
      }),
      quoteValues({
        requestId: wedding.id,
        operatorId: rajputana.id,
        vehicleId: null,
        request: wedding,
        terms: outstation({ perKmRatePaise: 2_600, tollIncluded: false }),
        requestedAt: askedAt,
        submittedAt: new Date(askedAt.getTime() + 26 * 60_000),
        status: "rejected",
      }),
      quoteValues({
        requestId: offsite.id,
        operatorId: pinkCity.id,
        vehicleId: coach45.id,
        request: offsite,
        terms: outstation({
          perKmRatePaise: 4_800,
          minKmPerDay: 300,
          driverBataPerDayPaise: 70_000,
          nightHaltPaise: 60_000,
          parkingIncluded: true,
        }),
        requestedAt: new Date(now - 2 * DAY),
        submittedAt: new Date(now - 2 * DAY + 12 * 60_000),
        status: "submitted",
      }),
      quoteValues({
        requestId: offsite.id,
        operatorId: shekhawati.id,
        vehicleId: null,
        request: offsite,
        terms: outstation({
          perKmRatePaise: 5_100,
          minKmPerDay: 250,
          driverBataPerDayPaise: 80_000,
        }),
        requestedAt: new Date(now - 2 * DAY),
        submittedAt: new Date(now - 2 * DAY + 41 * 60_000),
        status: "submitted",
      }),
      // Asked and still silent — the response-rate denominator has to be real.
      quoteValues({
        requestId: pilgrimage.id,
        operatorId: shekhawati.id,
        vehicleId: null,
        request: pilgrimage,
        terms: outstation(),
        requestedAt: new Date(now - 3 * 3_600_000),
        submittedAt: null,
        status: "requested",
      }),
      quoteValues({
        requestId: pilgrimage.id,
        operatorId: rajputana.id,
        vehicleId: null,
        request: pilgrimage,
        terms: outstation(),
        requestedAt: new Date(now - 3 * 3_600_000),
        submittedAt: null,
        status: "requested",
      }),
    ])
    .returning()

  const accepted = quotes[0]
  if (!accepted) throw new Error("quotes not created")

  const settings = await db.select().from(schema.platformSetting).limit(1)
  const advanceBps = settings[0]?.advanceBps ?? 2500
  const commissionBps = shekhawati.commissionBps ?? 1000

  const bookings = await db
    .insert(schema.booking)
    .values({
      reference: "TOLI-B-000001",
      tripRequestId: wedding.id,
      quoteId: accepted.id,
      customerId: aditi.id,
      operatorId: shekhawati.id,
      status: "completed",
      agreedTotalPaise: accepted.estimatedTotalPaise,
      advanceDuePaise: applyBps(accepted.estimatedTotalPaise, advanceBps),
      commissionBps,
      gstTreatment: "passenger_transport_5",
      placeOfSupply: "Rajasthan",
      intraState: true,
      trackingToken: trackingToken(),
      createdAt: new Date(now - 13 * DAY),
    })
    .returning()

  const booking = bookings[0]
  if (!booking) throw new Error("booking not created")

  const balance = booking.agreedTotalPaise - booking.advanceDuePaise

  await db.insert(schema.payment).values([
    {
      bookingId: booking.id,
      kind: "advance",
      mode: "upi",
      amountPaise: booking.advanceDuePaise,
      status: "captured",
      gatewayRef: "pay_PxT41kQm90",
      collectedAt: new Date(now - 13 * DAY),
    },
    {
      // Half the first year's balances are cash, and the settlement engine has
      // to be shown handling it or nobody will believe it does.
      bookingId: booking.id,
      kind: "balance",
      mode: "cash_to_driver",
      amountPaise: balance,
      status: "captured",
      collectedAt: day(-8, 20),
    },
  ])

  await db.insert(schema.assignment).values({
    bookingId: booking.id,
    vehicleId: tt26.id,
    driverId: ramesh.id,
    assignedAt: new Date(now - 11 * DAY),
  })

  await db.insert(schema.tripEvent).values([
    { bookingId: booking.id, kind: "dispatched", at: day(-9, 5, 10), detail: "Left the yard" },
    {
      bookingId: booking.id,
      kind: "started",
      at: day(-9, 6, 8),
      detail: "OTP verified, odometer photographed",
      odometerKm: 184_220,
      lat: "26.9124",
      lng: "75.7873",
    },
    { bookingId: booking.id, kind: "stop_reached", at: day(-9, 11, 40), detail: "Fatehpur Sikri" },
    {
      bookingId: booking.id,
      kind: "stop_reached",
      at: day(-9, 14, 20),
      detail: "Taj East Gate, Agra",
    },
    {
      bookingId: booking.id,
      kind: "completed",
      at: day(-8, 21, 15),
      detail: "Dropped at Hotel Clarks Amer",
      odometerKm: 184_713,
    },
  ])

  await db.insert(schema.locationPing).values([
    { bookingId: booking.id, at: day(-9, 6, 30), lat: "26.9500", lng: "75.8200", speedKmph: 48 },
    { bookingId: booking.id, at: day(-9, 9, 0), lat: "27.1767", lng: "77.0169", speedKmph: 62 },
    { bookingId: booking.id, at: day(-8, 21, 10), lat: "26.9010", lng: "75.8100", speedKmph: 12 },
  ])

  await db.insert(schema.tripExpense).values([
    { bookingId: booking.id, kind: "parking", amountPaise: 30_000, at: day(-9, 15) },
    { bookingId: booking.id, kind: "state_permit", amountPaise: 0, at: day(-9, 8) },
  ])

  const gst = extractGstFromGross(booking.agreedTotalPaise, "passenger_transport_5", true)

  await db.insert(schema.invoice).values({
    bookingId: booking.id,
    number: "TOLI/2026-27/00001",
    issuedAt: day(-8, 22),
    taxablePaise: gst.taxablePaise,
    cgstPaise: gst.cgstPaise,
    sgstPaise: gst.sgstPaise,
    igstPaise: gst.igstPaise,
    totalPaise: gst.totalPaise,
    gstTreatment: "passenger_transport_5",
    gstRateBps: gst.rateBps,
    sacCode: gst.sacCode,
    placeOfSupply: "Rajasthan",
  })

  const breakdown = computeSettlement({
    grossPaise: booking.agreedTotalPaise,
    commissionBps,
    tcsBps: settings[0]?.tcsBps ?? 100,
    tdsBps: settings[0]?.tdsBps ?? 100,
    expensesReimbursedPaise: 30_000,
    cashCollectedPaise: balance,
  })

  await db.insert(schema.settlement).values({
    bookingId: booking.id,
    grossPaise: breakdown.grossPaise,
    commissionPaise: breakdown.commissionPaise,
    tcsPaise: breakdown.tcsPaise,
    tdsPaise: breakdown.tdsPaise,
    expensesReimbursedPaise: breakdown.expensesReimbursedPaise,
    cashCollectedPaise: breakdown.cashCollectedPaise,
    netPayablePaise: breakdown.netPayablePaise,
    status: "released",
    releasedAt: day(-7, 12),
  })

  await db.insert(schema.review).values({
    bookingId: booking.id,
    cleanliness: 5,
    driverBehaviour: 5,
    punctuality: 4,
    matchedBooking: 5,
    comment: "Vehicle was exactly as shown. Driver waited two hours at Fatehpur without complaint.",
  })

  await db.insert(schema.auditLog).values({
    kind: "request_created",
    actor: "seed",
    detail: "Seeded Jaipur data: 3 operators, 5 vehicles, 3 RFQs, 1 completed booking",
  })

  console.log("Seeded:")
  console.log("  3 operators, 5 vehicles (one with lapsed insurance), 3 drivers")
  console.log("  3 customers, 3 RFQs, 7 quotes (2 still unanswered)")
  console.log(`  1 completed booking — tracking link /track/${booking.trackingToken}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
