# toli — session log

One entry per build session, newest last. Append; never edit an existing
entry, for the same reason migrations are append-only — a corrected record of
what was decided is no longer a record.

Each entry answers: what was asked, what changed, what was decided and why,
what was rejected, and what is still open.

---

## Scaffolded

**Asked:** create the app.

**Changed:** scaffolded from werft-template — App Router, single-operator
auth, Neon via Drizzle, design tokens, the PR gates, and `@claude` wired to
the operator's Claude subscription.

**Decided:** nothing yet beyond the template's own choices, which are in
AGENTS.md.

**Open:** everything the app is actually for. See ARCHITECTURE.md, which is
still a set of empty headings until the first feature lands.

---

## The ops console — 10 August 2026

**Asked:** read the code and the build plan in `docs/`, and implement the
project.

**Changed:** built the marketplace, as the ops console the plan's Phase 0 and
Phase 1 actually need.

- **Domain layer** (`src/domain/`), pure and unit-tested — 91 tests: the §7.1
  pricing engine with estimated and worst-case totals; GST across all three
  §8.3 treatments with the CGST/SGST/IGST split both ways; settlement with
  commission, TCS, TDS, expense reimbursement and driver cash; §8.5 compliance
  rules including the AITP interstate block and the twelve-year age limit; the
  §4.6 vehicle taxonomy and §9 lifecycle machine; the §7.2 fair-price band;
  §13's metric definitions; Indian states with GST codes; paise arithmetic and
  IST formatting.
- **Data model** — migration `0001_toli_marketplace`: 21 tables, 15 enums,
  covering §9's entity map end to end.
- **Console** — control tower, RFQ desk with requirement builder and quote
  comparison, operator onboarding with document verification, fleet, compliance
  queue, booking detail from payment through settlement, and settings.
- **Public tracking page** at `/track/[token]`, exempted in the proxy matcher.
- **Seed script** with realistic Jaipur data, per §5.3's instruction not to
  seed `John Doe`.
- README, ARCHITECTURE and the smoke suite rewritten; the template's
  placeholder home page deleted.

**Decided, and why:**

- **Build surface 5, not surface 1.** The plan wants five surfaces, four of
  them mobile and out of scope for a Next.js repo. It also says to run the
  first two hundred bookings by hand before writing matching code, and that
  fifty real negotiations teach the quote schema better than six months of
  design. The admin console is the surface that makes that possible, and it is
  what the mobile apps will later write into. Building a customer app first
  would mean building the wrong quote schema twice.
- **Refuse an incomparable quote rather than store it.** `minKmPerDay` and
  `statePermitIncluded` are mandatory because they are where the ₹28,000 → ₹41,000
  surprise lives. Enforced in `validateQuoteTerms`, not left to the form.
- **Show a worst case, itemised.** "Up to ₹41,000" is frightening; "₹41,000 if
  you cross two state borders and run 300 km over" is actionable. The
  allowances behind it are estimates and are labelled as such.
- **Record the fan-out before any reply.** Inviting an operator writes a
  `requested` quote row. Without that timestamp the response rate — the metric
  the plan says everything else depends on — would only ever count RFQs someone
  happened to answer.
- **Compliance is recomputed on every read**, and assignment is judged against
  the *trip date*, not today. A permit valid this week and expired next week is
  fine for tomorrow's departure and not for the one after.
- **Model both GST treatments and default one in settings.** §8.3 is explicitly
  unresolved until a CA answers; hard-coding either would be answering it in
  code, which the plan forbids in as many words.
- **Model cash-to-driver in settlement.** §8.1 says half the first year's
  balances will be cash. A settlement engine that ignores it pays every
  operator twice.
- **Aggregate in application code, not SQL.** At Phase 1 volumes it is a few
  hundred rows, and it keeps one definition of each metric shared by the
  dashboard and its tests.

**Rejected:**

- **A customer-facing booking flow.** The app has one login by template rule,
  and a public booking surface needs a real user store — a decision to raise,
  not to implement quietly.
- **Faking the integrations.** No stub payment gateway, no mock VAHAN
  response, no simulated GPS stream. A stub that looks like it works is worse
  than an obvious gap: it gets trusted. Each is named in Known gaps with what
  it will replace.
- **Storing a `compliant` boolean on the vehicle.** It would be wrong every
  midnight.
- **A time-series store for positions.** Timescale is right at scale and
  unnecessary at a hundred trips a month.

**Open:**

- Migrations have **not** been run against any database in this session — no
  `DATABASE_URL` was available. `pnpm db:migrate` then `pnpm db:seed` before
  the console has anything to show.
- The seed script is therefore unexercised against a live Postgres, though it
  typechecks and reuses the same domain functions as the app.
- Payment gateway, government verification, maps and routing, WhatsApp
  notifications, and live GPS ingest — all listed in ARCHITECTURE.md under
  Known gaps, with what each would replace.
- Reference numbers come from a row count; correct for one desk, and a
  Postgres sequence the day there are two.
- `leakageSuspect` is implemented and tested but has no screen yet.

---

## The five integrations — 10 August 2026

**Asked:** "build these no payment gateway, no VAHAN, no maps, no WhatsApp, no
GPS ingest" — the five gaps the previous entry listed as deliberately missing.

**Changed:** all five built. One works today; four are complete but need an
account nobody has opened yet, and say so rather than pretending.

- **Position ingest** (needs nobody): `POST /api/ingest/ping` for a driver app,
  single or replayed batch; `POST /api/ingest/vltd` for an AIS-140 telematics
  feed. Per-device bearer tokens, stored only as SHA-256. Implausible positions
  refused, deviation raised once per trip, `ingest_device` enrolment in the UI.
- **Payments**: Razorpay payment links over `fetch`, and a webhook that verifies
  an HMAC over the raw body before parsing it, records every event under a
  unique (provider, event id), and attributes captures to a booking.
- **Maps and routing**: a `MapProvider`-shaped module — Google Places first,
  Mappls when Google's confidence is low, self-hosted OSRM for the road
  distance every quote needs. Results cached in `geo_cache`, geocodes forever
  and routes for 30 days, keyed on rounded coordinates.
- **WhatsApp**: an outbox table plus template composers for booking
  confirmation, driver details, tracking link, payment reminder and invoice.
- **Verification**: VAHAN, Sarathi and GSTN through an authorised aggregator,
  writing into the same `compliance_check` table a person writes to today.
- Supporting pure code, all tested: GSTIN checksum, PAN, registration
  normalisation, E.164 phone handling, haversine, deviation, stopped-for,
  cache keys. Migration `0002_integrations`. A new `/integrations` screen.
  59 new unit tests, 150 in total.

**Decided, and why:**

- **"Not configured" is a state the app shows, not one it hides.** An ops
  person needs to know whether the payment-link button will do anything before
  promising a customer a link. Every integration reports which variable is
  missing and what the manual path is meanwhile.
- **Nothing was stubbed.** No mock VAHAN response, no fake capture, no
  simulated GPS. The previous session's README promised that and it would have
  been easy to quietly break here — a stub that looks like it works is worse
  than a gap, because it gets trusted.
- **Verify before parse, record before act.** The webhook is the only
  unauthenticated path that can mark money received; without the HMAC, anyone
  who learns a booking reference could mark a ₹40,000 trip paid.
- **Provider names live in configuration, not column names.** `payment` carries
  a `provider` string. Choosing Cashfree later is an adapter, not a migration.
- **The alias was added to vitest rather than avoided in source.** A test that
  fails because two resolvers disagree is a test failing for a reason that has
  nothing to do with the code.

**Rejected:**

- **A `.gitleaks.toml` allowlist** for the two false positives on the previous
  PR. An allowlist is a permanent hole punched for a temporary embarrassment;
  renaming a badly-named constant and deleting a redundant field fixed both at
  the source.
- **Map rendering in the console.** It would need an unblessed dependency, and
  the plan says to deep-link out rather than build navigation.
- **Route-geometry deviation matching.** It needs a stored polyline from a
  provider that may not be configured; nearest-planned-stop is coarser and
  works with what is always known.
- **Retrying a payment webhook on a body that cannot be parsed.** Answering 200
  and storing it stops a provider retrying a malformed request forever.

**Verified:** the ingest and webhook paths were exercised end to end against a
throwaway Neon branch created for the purpose and deleted afterwards — bad
token 401, valid ping accepted, Null Island and out-of-India refused, VLTD
vendor payload normalised, deviation raised once across two pings, tracking
page showing the position with no login, unsigned webhook 401, signed 200,
replay `duplicate`, tampered body 401 with zero forged rows. The four
credentialled integrations could not be exercised against their providers and
are marked as such in ARCHITECTURE.md.

**Open:**

- Migration `0002` has **not** been applied to production; the deploy applies
  it on merge.
- Razorpay Route / Easy Split — §8.2's escrow posture — is still not used.
- Cashfree, an SMS fallback, cloud-telephony number masking, and vendor-specific
  VLTD quirks all remain.
