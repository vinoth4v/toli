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
- **AppUser** — somebody who signs in, with one of four roles and a link to
  what they *are*: an operator user has an operator, a driver user has a
  driver, a customer user has a customer.

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

Migration `0003_app_users` added `app_user` and the `app_role` enum, replacing
the template's single-operator gate. The environment identity survives as
break-glass admin access.

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
| **`/`** | **Public.** The marketplace's front page. Signed in, it redirects to the signer's own home |
| `/account` | Every signed-in role — avatar upload, language, sign out |
| `/portal`, `/portal/new`, `/portal/trips/[id]` | **customer** — trips, ask for a vehicle, compare quotes and book |
| `/partner`, `/partner/quotes/[id]`, `/partner/fleet`, `/partner/earnings` | **operator** — quote inbox, the §7.1 form, fleet paperwork, settlements |
| `/partner/team` | **operator** — their drivers: add one, and issue their driver-app sign-in, password shown once |
| `/drive`, `/drive/[id]` | **driver** — today's trip, start, stops, expenses, finish, SOS |
| `/console` | **admin** — control tower: §13 metrics, live trips, RFQs with no quotes, quotes awaiting a decision |
| `/console/rfqs`, `/console/rfqs/new`, `/console/rfqs/[id]` | The RFQ desk: requirement builder, operator fan-out, quote comparison, acceptance |
| `/console/bookings`, `/console/bookings/[id]` | Payments, assignment, trip events, positions, expenses, invoice, settlement, review, disputes |
| `/console/operators`, `/console/operators/new`, `/console/operators/[id]` | Onboarding, fleet, drivers, documents, verification |
| `/console/fleet` | Every vehicle judged against its own paperwork; lifecycle transitions |
| `/console/compliance` | Verification queue and expiry ladder, ordered by consequence |
| `/console/settings` | Commission, TCS, TDS, advance %, GST treatment, home state — plus the audit log |
| `/console/integrations` | What is wired up and what is not, per variable; device enrolment; the outbox |
| `/partner/rates` | **operator** — standing rates, which is what makes instant booking possible |
| `/login` | The gate |
| **`/register`** | **Public.** Self-registration: customers self-serve, operators apply (created `pending_verification`), drivers are told their operator issues their sign-in |
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
- **The brand is a theme, and the theme is the redesign.** `toli` in
  `@werft/tokens` — ink on paper, one bold weight, colour reserved for meaning
  (green = live/settled, red = stop). Because every component already reads
  tokens, the whole app re-skinned from one definition; the CSS "brand" layer
  only sets posture (weight, tracking, stickiness, motion). The logo is a route
  mark — dot, road, pin — drawn in currentColor so it inverts in the footer.
- **The accent is terracotta, not ink.** An all-black interface read as an
  Uber clone, which a marketplace asking for trust cannot afford. The accent
  token is now the terracotta the hero's gopuram already wore — so buttons,
  links, eyebrows and step numbers warmed across every surface in one token
  change, and the identity became "ink, terracotta, hand-drawn south-Indian
  scenes", which nobody else owns.
- **The illustrations are artwork, not UI.** Three hand-drawn SVG scenes —
  the Madurai–Kodaikanal ghat road in the hero, the Pamban bridge crossing to
  Rameswaram above "How it works", a sleeper coach on a night leg with the
  fleet owners — all animated in CSS (clouds, wheels, waves, a crossing bus,
  twinkling stars), all stilled by `prefers-reduced-motion`. Their palettes
  are internal to the images — the same standing a photograph would have —
  and are the one deliberate exception to the tokens-only rule, so the UI can
  stay two-colour while the world it depicts is not.
- **Avatars upload like vehicle photos.** Presigned PUT to `avatars/<userId>/…`,
  recorded on `app_user` (migration `0008`); initials are the designed default,
  not a failure state. `/account` is the one surface every role shares — face,
  language, sign out — so four layouts do not each grow a profile corner.
- **Authorisation is one pure module, checked at the edge.** `domain/roles.ts`
  answers "may this role see this path", and `auth.config.ts`'s `authorized`
  callback is the only caller that matters — so a role cannot reach another
  surface even for the instant before a layout redirects. Access is an
  allow-list of prefixes, so a route added tomorrow is closed to everyone until
  somebody says otherwise.
- **A signed-in person on the wrong surface is redirected, not bounced to
  login.** They are authenticated and simply in the wrong place; sending them
  to a sign-in form they have already passed would be a bug that looks like a
  security feature.
- **Ownership lives in the WHERE clause.** `data/scoped.ts` takes the id from
  the session and never from a URL. A check written as an `if` after the query
  is the one that gets forgotten during a refactor.
- **The driver's queries do not select money at all.** Not the trip value, not
  the quote, not the settlement — an explicit projection rather than
  `select()`, so a column added to `booking` later cannot leak onto a driver's
  screen. §3 says a driver who learns the take rate can disintermediate the
  platform, and this is that rule made structural.
- **The role is in the JWT.** No database round trip per request; the cost is
  that a role changed in the database takes effect on next sign-in. For four
  accounts that is the right trade, and a revocation list is what changes it.
- **Break-glass access is kept on purpose.** `WERFT_USER_EMAIL` and
  `WERFT_PASSWORD_HASH` still sign in as an admin, checked before any database
  call — an app whose only administrator is a row in an unreachable table has
  no way back in.
- **`/` is public and decides for itself.** A visitor sees the marketplace; a
  signed-in operator is redirected to `/console`. That satisfies both halves of
  the rule that matters — the front door looks like a business rather than a
  bare login form, and the operator never clicks past a welcome page to reach
  the app they run. It is why the matcher exempts `/$` exactly, not `/`.
- **Two lanes produce identical rows.** An instant booking creates the same
  request, quote, booking and assignment a quoted one does. Settlement,
  invoicing, compliance and the console must not need to know which lane a trip
  came through, or each grows a second code path.
- **Segment is derived, never declared.** `segmentFor` reads `ac` and
  `features`, so an operator moves a vehicle up a rung by fitting the thing,
  not by claiming it. A better vehicle may serve a cheaper booking; the reverse
  is mis-selling.
- **Availability is re-checked at the moment of booking.** Between the search
  and the tap somebody else may have taken the vehicle; the action re-runs
  `findOffers` rather than trusting the form.
- **Nothing unbookable is ever shown.** Compliance is judged against the travel
  date before an offer is rendered — being refused after choosing is worse than
  never seeing it.
- **The launch corridor is a constraint, not a default.** Madurai and south
  Tamil Nadu; see `LAUNCH_CITIES`. Examples and seed data stay there so the
  product never implies coverage it does not have.
- **Translations are typed, not looked up.** A `Dictionary` type per locale
  means adding an English string and forgetting Tamil fails the build.
- **An operator may add and retire their own vehicles, but never verify them.**
  Self-certification would hollow out the one rule this marketplace enforces
  hardest, so a vehicle added by an operator lands `pending_verification` and
  Toli checks the papers. Removing is retiring, never deleting — bookings,
  settlements and compliance history stay answerable after the bus is sold.
- **Photos upload straight to object storage.** A presigned PUT means a
  four-megabyte image never passes through a function billed by the
  millisecond. SigV4 is signed by hand rather than by an SDK the dependency
  list does not bless; the signing is pure and tested, because a subtly wrong
  signature fails with an opaque 403 that looks like a credentials problem.
- **Toli's number is published; the operator's is released on booking.** §10's
  masking is about *when* a customer may reach an operator, not whether. Indian
  customers phone before they pay, and a marketplace with no visible number
  reads as one with nobody behind it.
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
- **Registration exists; password reset does not.** Customers self-register
  and are served immediately; operators apply (row created
  `pending_verification`, sellable only after ops verifies); drivers get their
  sign-in from their operator on `/partner/team`, password shown exactly once
  and stored only as a hash. Three different shapes on purpose — a
  self-registered driver with no operator behind them is the unverified
  stranger this marketplace exists to remove. A forgotten password is still a
  call to Toli ops.
- **A customer row created by ops cannot be claimed online.** Registering with
  a phone number that already exists is refused, because attaching a new
  sign-in to an existing customer's trips on the strength of knowing their
  phone number is account takeover. Linking is a human's job until OTP exists.
- **No per-field permissions within a role**, which §4.4 eventually wants.
- **No session revocation.** Disabling an account stops the next sign-in, not
  the current session, because the role lives in the token.
- **The customer portal cannot pay yet.** It books; taking the advance is the
  Razorpay integration, which needs credentials.
- **The `hi`, `te`, `ml` and `kn` translations have not had a native-speaker
  pass.** They are careful but unreviewed, and should be checked before the
  soft launch — a mistranslated SOS hint is worse than English.
- **Maps are an OpenStreetMap iframe**, chosen over a mapping library the
  dependency list does not bless, and over the Maps Embed API, which needs a
  billing account this app does not have. **Confirmed rendering in a real
  browser** on 11 August 2026 — it had shown blank tiles in an automation
  browser, which turned out to be that environment rather than the embed.
  Captions still carry the coordinates in text beside a link out, because OSM
  answers a request without an acceptable referer with a blank 103-byte tile
  and a map that fails should still say where the vehicle is. The remaining
  limitation is data, not plumbing: OSM's Indian street coverage is thinner
  than Google's, which is exactly why §6.1 recommends Mappls for village-level
  work.
- **The driver's location sharing is foreground-only.** §6.3 wants a
  `ForegroundService` pinging every ten seconds; a web page cannot do that,
  because the browser stops running when the screen locks. The button sends one
  fix and an optional repeat while the screen stays on, and the UI says so
  rather than implying background tracking.
- **Photo verification is not wired to the ops queue.** A photo lands
  `pending` and nothing surfaces it for review yet, so the verified-photo badge
  §4.1 wants is not yet earned.
- **The operator's fleet screens are English.** They are used by office staff;
  the customer portal and driver app are the translated ones.
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
