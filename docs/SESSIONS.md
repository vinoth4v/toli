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

---

## A front door — 11 August 2026

**Asked:** redesign the home page attractively; create four role accounts
(admin, user, tour operator, driver) with credentials and a distinct UI each;
remove the generic login page that the production URL was showing.

**Changed:** the home page and the routing around it.

- `/` is now a public marketing page: the hero, the two-quote comparison that
  is the product's whole argument, how it works, the fleet taxonomy pulled
  from the domain module rather than retyped, what is checked before a vehicle
  carries anyone, and an operator section showing a full settlement.
- The console moved to `/console/*`. Signed in, `/` redirects there.
- `/login` redesigned to match, and is no longer what a visitor to the
  production URL sees — which was the actual complaint.
- Two token additions: display type sizes (`3xl`, `4xl`, `xs`) and larger
  spacing steps (`16`, `24`). Every theme shares them, so nothing was pinned
  to one look.
- Smoke suite rewritten for the new shape: the front page is public and is the
  marketplace, every `/console/*` route redirects, ingest and webhook stay
  reachable without a session.

**Decided, and why:**

- **`/` decides for itself rather than being two routes.** A marketing page at
  `/` risks becoming exactly the placeholder the template forbids — the
  operator clicking past a welcome screen to reach their app. Redirecting when
  a session exists satisfies both requirements at once.
- **The comparison is the hero's neighbour, not a photograph of a bus.** The
  plan's claim is that quotes are not comparable; showing two quotes where the
  cheaper per-km rate is the more expensive booking makes that argument in one
  screen.
- **Numbers on the page come from the seeded worked example**, not from
  invention — the ₹15,960 booking and its ₹2,534 settlement are the ones in
  the database.

**Not done, and raised instead:** the four role accounts. `AGENTS.md` says in
as many words: *never add a second user; a real multi-user app needs a real
user store — that is a decision to raise, not to implement quietly.* Four
roles with four distinct interfaces is that decision, so it is a question
rather than a commit. The options and their costs went back to the operator.

**Open:** the multi-user question, and with it whether per-role interfaces are
built as real surfaces or as a demo.

---

## Four roles, four applications — 11 August 2026

**Asked:** create four accounts — admin, user, tour operator, driver — share
the credentials, and give each profile a distinct, high-quality interface.

**Raised first:** `AGENTS.md` said *never add a second user; a real multi-user
app needs a real user store — that is a decision to raise, not to implement
quietly.* It was raised, with the cost of each option and the risk of sharing
working credentials for a live app holding real data. The operator chose the
real user store, production wipe-and-reseed, and generated passwords shown
once. That rule in `AGENTS.md` has been rewritten rather than left to
contradict the code — it now governs adding a *fifth* role.

**Changed:**

- `app_user` (migration `0003_app_users`) with an `app_role` enum, linked to
  the operator, driver or customer the account *is*.
- Sign-in reads the user store; the role travels in the JWT and is enforced in
  the edge `authorized` callback via `domain/roles.ts` — 10 unit tests,
  including that `/portalx` must not match `/portal`.
- `data/scoped.ts`: every "my data" query takes its id from the session and
  puts ownership in the WHERE clause.
- Three new surfaces beside the console, each designed for its reader rather
  than themed differently: `/portal` (calm, consumer, big dates, quotes framed
  for someone who has never heard the word *bata*), `/partner` (dense work
  tool, oldest unanswered RFQ loudest, settlements itemised), `/drive` (huge
  type, 3.5rem targets, one-tap actions, no money on any screen).
- `db:seed-users` generates passwords, prints them once, stores only scrypt
  hashes. `db:reset` wipes every table but the audit log, and refuses without
  `CONFIRM_RESET=yes`.
- Seed gained a second booking departing tomorrow, assigned to a driver —
  without it the driver app is an empty screen and demonstrates nothing.

**Decided, and why:**

- **The driver sees no money, structurally.** §3 warns that a driver who learns
  the take rate can take the customer off-platform. So `driverTrips` is an
  explicit projection with no price column in it, rather than a template that
  omits one — a column added to `booking` later cannot leak.
- **Break-glass admin kept.** The environment identity still signs in, checked
  before any database call. An app whose only administrator is a row in an
  unreachable table has no way back in.
- **Wrong-surface means redirect, not sign-in.** The person is authenticated
  and merely in the wrong place.
- **Allow-list, not deny-list.** A route added tomorrow is closed to every role
  until someone says otherwise.

**Rejected:**

- **Demo accounts with memorable passwords.** Offered and declined in favour of
  generated ones; the app holds operator PANs and settlement data.
- **One interface with a role switcher.** It would have been a fraction of the
  work and would have contradicted §3's central claim that these are different
  people with different rights.
- **A database lookup per request** to make role changes instant. Not worth it
  at four accounts; noted as the reason revocation is not immediate.

**Verified:** all four accounts signed in through a real browser against a
throwaway Neon branch, each landing on its own surface. The driver was pushed
back to `/drive` from `/console`, `/partner/earnings` and `/portal` in turn.
The customer's list showed only her own trip. The branch was deleted
afterwards. Production was then migrated, wiped and reseeded, and the four
accounts created there — 4 scrypt hashes, 0 plaintext.

**Open:** no self-registration, password reset or invitations; no per-field
permissions inside a role; no session revocation, since the role is in the
token; the portal books but cannot yet take payment, which needs Razorpay
credentials.

---

## Two lanes, segments, and a move to Madurai — 11 August 2026

**Asked**, across several messages while the work was in flight: say plainly
that tolls appear on the bill; shift strategy from agent-style RFQ towards an
Uber-shaped "show me what is available and book it"; keep the quote lane
because that is the habit for long trips; add Europcar-style segments
(economy/premium/luxury); show the customer their bill; relocate the launch to
Madurai and south Tamil Nadu with copy to match; add Tamil, then South Indian
languages rather than only Hindi; and let a customer request a driver who
speaks their language.

**Changed:**

- **Lane B, book now** — `data/availability.ts` finds vehicles that are free,
  road-legal *on the travel date*, big enough, and good enough for the segment,
  then prices each from its operator's standing rate card. `/portal/book` is
  the search; booking re-checks availability rather than trusting the form.
- **Rate cards** (`0004`) — the thing §4.2 calls "rate card mode", and what
  makes instant pricing possible at all.
- **Segments** — derived from `ac` and `features`, so "luxury non-AC" cannot be
  expressed. A better vehicle may serve a cheaper booking, never the reverse.
- **The bill** (`domain/bill.ts`) — quoted total, then every charge the quote
  excluded, itemised and marked, with tax on the additions and a plain sentence
  about tolls in both directions. Shown on the customer's trip.
- **Madurai** — corridor, seed data, registrations, names, routes and landing
  copy. Recorded in `LAUNCH_CITIES` with the reasoning, so it is a constraint
  rather than a default somebody drifts away from.
- **Six languages** — typed dictionaries for en/ta/hi/te/ml/kn, a cookie, and a
  switcher component. Drivers carry the languages they speak; a customer can
  ask for one, and matching drivers are picked and sorted first.

**Decided, and why:**

- **Both lanes produce identical rows.** An instant booking creates the same
  request, quote, booking and assignment. Anything else means settlement,
  invoicing and compliance each grow a second code path.
- **Hindi is in the language list, not at the head of it.** For a Madurai
  launch the first language after English is Tamil. A Tamil-speaking driver
  handed a Hindi interface is exactly the failure to avoid.
- **The ops console and partner tool stay English.** They are used by staff and
  office dispatchers; a badly translated settlement statement is worse than an
  untranslated one.
- **Nothing unbookable is shown.** Filtering by compliance before render, not
  refusing after choosing.

**Rejected:**

- **Replacing the quote lane.** The instruction was to move *towards* instant
  booking, and the plan's own §11 keeps both. Long trips and large groups
  genuinely need negotiation.
- **A translation library.** Six flat dictionaries and a cookie keep the
  blessed-dependency list intact and make a missing string a build error.

**Open:**

- The `hi`/`te`/`ml`/`kn` strings need a native-speaker pass before launch.
- The switcher is not yet mounted in the portal and driver layouts, so the
  language choice is not user-visible yet.
- Operators cannot edit their own rate cards.
- Instant booking is intra-state only for now.
- Production still holds the previous Jaipur seed; reseeding to Madurai will
  reissue all four sets of credentials.

---

## Sign-in asks who you are first — 11 August 2026

**Asked:** the sign-in page was confusing — it should ask who is signing in
*before* letting them sign in.

**Changed:** `/login` is now two steps. Step one is the four doors and nothing
else; step two is the form, headed with the surface being entered and a "Not
you? Choose again" way back. A rejected attempt returns to step two rather
than dumping the person back at the chooser, which is why the form carries the
chosen role in a hidden field.

**Decided:** the first version put the form first with the doors underneath,
which asked people to type a password before knowing which application they
were entering — and left three of the four audiences unsure they were in the
right place. The chooser still only changes wording; the account decides where
somebody lands, and the second step says so.

**Verified:** the smoke suite now asserts that `/login` shows no email or
password field at all, that each role's card reveals the form, and that a junk
`?as=` falls back to the chooser. The gate test was updated in the same pass —
it was still asserting a form on a page that no longer has one.

---

## Tamil, and the defaults that never moved — 11 August 2026

**Asked:** the prefilled locations were still Jaipur and Rajasthan; add a Tamil
language pack.

**Changed:**

- Every form default and placeholder follows the launch market: Madurai, Tamil
  Nadu, Hotel Germanus, Kodai Lake, a TN registration. The seed and
  `LAUNCH_CITIES` had moved a session earlier; the hard-coded defaults had not,
  which is exactly the kind of thing a documented constraint is supposed to
  catch and did not.
- Test fixtures moved too, since the constraint covers examples: the quote
  fixture is now Madurai → Munnar, which also happens to be genuinely
  interstate, and the geo fixtures are Madurai, Batlagundu, Kodaikanal and
  Rameswaram with distances re-derived rather than adjusted to pass.
- The language switcher is mounted in the driver app and the customer portal,
  and both now read their strings from the dictionary — so the six languages
  are reachable rather than merely present.

**Found while verifying, and fixed:**

- The customer note on the seeded pilgrimage trip still read "Ajmer Sharif".
  The Madurai rename replaced "Pushkar" globally *before* the note pattern ran,
  so the note never matched — a silent partial rename that only showed up on
  screen. The one row already in production was corrected in place.
- The driver's trip header read "16 பயணிகள் · 17" because translating the line
  dropped the word "seats" entirely. A `driveSeats` key now exists in all six
  languages.

Both were found by signing in as the driver and switching to Tamil, not by
reading the diff — which is the argument for looking at the screen.

**Open:** the portal's deeper screens (quote comparison, bill, book-now) are
still English; the dictionary covers the surfaces a non-English reader meets
first. The `hi`/`te`/`ml`/`kn` strings still need a native pass.
