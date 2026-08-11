# toli — architecture

How this app works, in its current form. Rewritten whenever the design
changes, so it describes the present rather than accumulating history —
that is SESSIONS.md's job.

## Purpose

India's aggregator marketplace for chartered vans, tempo travellers and buses — transparent quotes, verified operators, live tracking.

Concretely, this repository is **surface 5 of the five in the build plan**: the
Toli Admin console. It is the tool for running the marketplace by hand during
Phase 0 and Phase 1 — take the requirement, ask operators, record the quotes in
one schema, book, dispatch, invoice, settle. The customer, partner and driver
apps are separate mobile work and do not live here.

The plan itself is `docs/00-index.md` and its five parts; section references
throughout the code (§7.1, §8.3) point into it.

## Domain model

- **Operator** — a fleet-owning firm. Has vehicles, drivers, a commission rate
  (its own or the platform default), and a tier that decides how fast it is
  settled.
- **Vehicle** — a registration, a class from the market taxonomy, a seat count,
  a year, and a lifecycle: `draft → pending_verification → active → suspended →
  retired`. Never legal by assertion; legal by documents.
- **VehicleDocument** — RC, state permit, AITP, fitness, insurance, PUC, VLTD.
  Each carries an expiry date and a verification state.
- **Driver** — licence plus the three MVAG 2025 clearances: police
  verification, medical, induction training.
- **Customer** — identified by phone. Optionally GST-registered, which changes
  the place of supply.
- **TripRequest (RFQ)** — one group's requirement: type, origin city and state,
  dates, stops, passengers, vehicle class, features, extras, states crossed.
  Naming a state crossed is what makes a trip interstate, which is what makes
  an AITP mandatory.
- **Quote** — an operator's answer, in the fixed schema of §7.1. Two totals are
  snapshotted onto it: estimated and worst case.
- **Booking** — an accepted quote, frozen. Carries its own tracking token.
- **Assignment, TripEvent, LocationPing, TripExpense** — what actually happened.
- **Invoice, Settlement** — money out, in both directions.
- **Review, Dispute** — after the trip.
- **ComplianceCheck, ConsentRecord, AuditLog** — the records regulators ask for.

Two invariants run through all of it: **money is integer paise**, and
**timestamps are UTC, rendered IST**.

## Data model

Migration `0000_audit_log` (from the template) created `audit_log`.

Migration `0001_toli_marketplace` created everything else — 21 tables and 15
Postgres enums:

| Table | Holds |
|---|---|
| `operator` | fleet firms; `commission_bps` nullable, meaning "use the platform rate" |
| `vehicle` | registration (unique), class, seats, year, features, lifecycle status, suspension reason |
| `vehicle_document` | kind, number, `expires_on` as a **date** (a permit expires on a day, not an instant), verification |
| `driver` | licence and the three clearance dates |
| `compliance_check` | one row per government-source lookup, kept even when it fails |
| `customer` | phone unique — the identity in this market |
| `consent_record` | DPDP purpose-limited consent, withdrawable |
| `trip_request` | the requirement, plus `state` (origin) which decides place of supply |
| `stop` | ordered stops; lat/lng as text because they are only displayed or linked |
| `quote` | every §7.1 field as a column, plus both snapshotted totals and `requested_at`/`submitted_at` |
| `booking` | frozen copies of total, commission, GST treatment, place of supply, intra-state flag; unique `tracking_token` |
| `payment` | advance/balance/refund × UPI/card/netbanking/NEFT/cash-to-driver |
| `assignment` | vehicle + driver, with `sub_contracted_to_operator_id` for the liability trail |
| `trip_event` | dispatched, started, stop_reached, deviation, sos, completed, note |
| `location_ping` | positions; ordinary table, not a time-series store |
| `trip_expense` | toll, parking, fuel, state permit |
| `invoice` | every component stored — taxable, CGST, SGST, IGST, total, rate, SAC, place of supply |
| `settlement` | gross, commission, TCS, TDS, expenses, cash collected, net; unique per booking |
| `review` | four axes, not one star rating |
| `dispute` | kind, description, resolution, refund |
| `platform_setting` | one row, id `default`: commission, TCS, TDS, advance %, GST treatment, home state, quote validity |

Migration `0002_integrations` added the tables the external systems write into,
and four provider columns on `payment`:

| Table | Holds |
|---|---|
| `ingest_device` | a driver phone or VLTD box allowed to post positions; only the token's SHA-256 is stored, plus its last four characters |
| `geo_cache` | geocodes (no expiry) and routes (30 days), keyed on rounded coordinates per §6.2 |
| `notification` | the outbox: one row per message, written before the API call, with the rendered variables kept |
| `webhook_event` | every inbound webhook; unique on (provider, event id), which is what stops a retry recording a payment twice |

`payment` gained `provider`, `provider_order_id`, `provider_payment_id` and
`provider_link_url` — deliberately provider-neutral names, so a second gateway
sits beside the first without a migration.

Money columns are `bigint` in `number` mode. `integer` would overflow at
₹21.4 lakh in paise, which a single 45-seat coach charter can approach and a
GMV total passes immediately.

## Surfaces

Everything is behind the operator gate unless stated otherwise.

| Route | What it is for |
|---|---|
| **`/`** | **Public.** The marketplace's front page. Signed in, it redirects to `/console` |
| `/console` | Control tower: §13 metrics, live trips, RFQs with no quotes, quotes awaiting a decision |
| `/console/rfqs`, `/console/rfqs/new`, `/console/rfqs/[id]` | The RFQ desk: requirement builder, operator fan-out, quote comparison, acceptance |
| `/console/bookings`, `/console/bookings/[id]` | Payments, assignment, trip events, positions, expenses, invoice, settlement, review, disputes |
| `/console/operators`, `/console/operators/new`, `/console/operators/[id]` | Onboarding, fleet, drivers, documents, verification |
| `/console/fleet` | Every vehicle judged against its own paperwork; lifecycle transitions |
| `/console/compliance` | Verification queue and expiry ladder, ordered by consequence |
| `/console/settings` | Commission, TCS, TDS, advance %, GST treatment, home state — plus the audit log |
| `/console/integrations` | What is wired up and what is not, per variable; device enrolment; the outbox |
| `/login` | The gate |
| **`/track/[token]`** | **Public.** The guest tracking page — no app, no login |
| **`POST /api/ingest/ping`** | **Public.** Driver-app positions, one or a replayed batch. Device bearer token |
| **`POST /api/ingest/vltd`** | **Public.** AIS-140 telematics feed. Device bearer token |
| **`POST /api/webhooks/razorpay`** | **Public.** Payment callbacks. HMAC over the raw body |

Those four are the only exemptions in the proxy matcher, and each carries its
own credential because none of them can carry the operator's session: an
unguessable tracking token, a per-device bearer token stored only as a hash,
and an HMAC verified before the body is parsed. The tracking page reads a
deliberately narrow projection — no price, no phone number, no commission, and
no SOS events.

Server actions live beside the routes that use them (`rfqs/actions.ts`,
`bookings/actions.ts`, `operators/actions.ts`, `settings/actions.ts`). Each
validates with zod and returns failures as a redirect carrying an `error`
parameter, so a mistyped rate comes back as a sentence.

Domain logic is pure and separate, in `src/domain/`: `money`, `quote`, `gst`,
`settlement`, `compliance`, `vehicle`, `trip`, `fairprice`, `metrics`,
`india`, `format`. Database access is in `src/data/` (`supply`, `demand`,
`fulfilment`, `dashboard`, `settings`). Pages and actions compose the two and
hold no arithmetic of their own.

## External services

| Service | Variable | Notes |
|---|---|---|
| Neon Postgres | `DATABASE_URL` | The only external dependency this app has today |
| Auth.js session signing | `AUTH_SECRET` | |
| The single operator | `WERFT_USER_EMAIL`, `WERFT_PASSWORD_HASH` | |
| Kompass model gateway | `KOMPASS_BASE_URL`, `KOMPASS_TOKEN` | Present from the template; **nothing in this app calls a model yet** |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_BASE_URL` | Payment links and capture webhook. Not configured |
| Google Places | `GOOGLE_MAPS_API_KEY` | Urban geocoding. Not configured |
| Mappls | `MAPPLS_REST_KEY` | Village and landmark geocoding, used when Google is unsure. Not configured |
| OSRM | `OSRM_BASE_URL` | Road distance and duration for quoting. Not configured |
| WhatsApp Business | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_BASE` | Template messages. Not configured |
| Verification aggregator | `VEHICLE_VERIFY_BASE_URL`, `VEHICLE_VERIFY_API_KEY`, `VEHICLE_VERIFY_PROVIDER` | VAHAN, Sarathi, GSTN. Not configured |
| Public origin | `NEXT_PUBLIC_APP_URL` | Only used to build tracking links for outbound messages |

Every integration below Kompass is optional and currently off. `src/integrations/config.ts`
is the single place that decides whether one is configured, and
`integrationStatuses()` is what `/integrations` renders — so the app's answer to
"is this on" comes from one function rather than five scattered env reads.

## Decisions in force

- **The admin console first, and only.** The plan asks for five surfaces, four
  of them mobile. Phase 0 says to run the first two hundred bookings through a
  WhatsApp group and a spreadsheet; this console is that spreadsheet, done
  properly, and it is what the mobile apps will later write into. Building a
  customer app before the quote schema has survived fifty real negotiations
  would be building the wrong quote schema twice.
- **Money in integer paise, everywhere.** A settlement has to reconcile to the
  paisa across commission, TCS, TDS, expenses and cash. Floats do not.
- **Both GST treatments modelled, neither assumed.** §8.3 is unresolved and the
  plan says to get a written opinion and build for both. The treatment is an
  attribute of a booking, defaulted from settings. The answer changes a
  dropdown, not a migration.
- **Compliance is computed, never stored as a flag.** A certificate expires at
  midnight without anyone touching the database, so `assessVehicle` runs on
  every read, and `assignVehicle` calls it against the *trip date* rather than
  today.
- **Assignment refuses; it does not warn.** The alternative to a hard block is
  a coach detained at a border post with forty passengers inside.
- **Quotes are validated into comparability.** An outstation quote without a
  minimum km per day is rejected. That field is the single biggest customer
  trust win in the plan, and optional fields do not get filled in.
- **Both totals are snapshotted on the quote.** §9: never recompute a
  historical price. Recomputation elsewhere is for showing the working.
- **The fan-out is recorded before any reply.** An operator invitation creates
  a `requested` quote row. Without it, an RFQ nobody was asked about would
  count as one nobody answered, and the response rate — the metric — would
  flatter.
- **Aggregation happens in application code.** At Phase 1 volumes this is a few
  hundred rows, and it means the dashboard and the tests compute every rate
  through the same function in `domain/metrics.ts`.
- **The public tracking page gets a projection, not a row.** Purpose limitation
  under DPDP, and obvious besides.
- **`/` is public and decides for itself.** A visitor sees the marketplace; a
  signed-in operator is redirected to `/console`. That satisfies both halves of
  the rule that matters — the front door looks like a business rather than a
  bare login form, and the operator never clicks past a welcome page to reach
  the app they run. It is why the matcher exempts `/$` exactly, not `/`.
- **Percentages are stored as basis points.** 10% commission and 1% TCS are
  both integers that way, and nothing downstream multiplies by a float.
- **"Not configured" is a first-class state, never a silent fallback.** Four of
  the five external systems need an account nobody has opened. Each one says
  which variable is missing, on the screen and in the error, and each degrades
  to the manual path that worked before it existed. A stub that returns a
  plausible answer would be worse than the gap, because it would be trusted.
- **Providers are named in configuration, not in column names.** `payment`
  records a `provider` string; the verification client takes a base URL. The
  commercial choice between Razorpay and Cashfree, or between verification
  aggregators, must not be a migration.
- **Webhooks verify before they parse, and record before they act.** The HMAC
  is computed over the raw body, and the unique index on (provider, event id)
  is what makes a retry a no-op. Without both, anyone who learns a booking
  reference could mark a ₹40,000 trip paid.
- **Ingest tokens are stored only as hashes.** A leaked ingest token forges a
  vehicle's position, and a family watching a tracking link has no way to know.
- **An unrecognised webhook event is not an error.** A new event type in a
  provider's roadmap must not become an outage here, so anything unknown is
  stored and answered 200.

## Known gaps

- **Four integrations are written but unproven against a live provider.**
  Razorpay, Google/Mappls, WhatsApp and the verification aggregator have no
  account behind them, so their request shapes are built from published API
  documentation and have never received a real response. What *is* proven is
  everything that does not need the provider: signature verification, event
  interpretation, idempotency, template variable order, phone and GSTIN
  validation, cache keys, and the not-configured path — all unit-tested, and
  the webhook exercised end to end against a throwaway database with a
  self-signed payload.
- **Razorpay Route / Easy Split is not used.** Payment links collect money to
  the platform's own account, which §8.2 warns against as a routine posture.
  The split-settlement product is the correct answer and is a Phase 1 job.
- **Only Razorpay is implemented.** Cashfree is the named alternative and would
  be a second adapter beside the first.
- **The VLTD adapter is generic, not vendor-certified.** It reads the field
  names and shapes common to Indian telematics vendors; a specific vendor may
  need its own quirk, and that is a small addition to one normaliser rather
  than a new integration.
- **No 90-day GPS retention policy**, and no time-series store. Both matter at
  volume; neither matters at a hundred trips a month.
- **Deviation is measured to the nearest planned stop, not to the road line.**
  Coarser than route-geometry matching, and it needs no stored polyline; it
  still catches the case that matters.
- **No SMS fallback.** §4.5 wants DLT-registered SMS behind WhatsApp; the
  outbox has a `channel` column and only one channel is implemented.
- **Reference numbers come from a row count.** Correct for one desk, racy for
  two. A Postgres sequence is the fix the day a second person is typing.
- **No rate cards, so no auto-quoting.** §11 Phase 2, and it is the lever that
  moves response rate most.
- **No number masking through cloud telephony.** Phone numbers are masked in
  the UI, which is display hygiene, not the anti-disintermediation control of
  §10.
- **`leakageSuspect` is written and tested but not yet surfaced.** It needs
  per-operator quote and booking counts on a screen that does not exist.
- **One user, no RBAC.** §4.4 asks for roles and per-field access control over
  the admin console. That needs a real user store — a decision to raise.
- **No seat-level or empty-leg products, no corporate portal, no ONDC.** All
  Phase 3 and 4.
