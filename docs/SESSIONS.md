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

---

## Maps, and a phone that knows where it is — 11 August 2026

**Asked:** embed maps, and take GPS location from the app itself.

**Changed:**

- **Embedded maps** on the four surfaces where "where is it" is the question:
  the public tracking page, the customer's trip, the ops booking detail, and
  the RFQ route once its stops are geocoded. An OpenStreetMap iframe — no key,
  no billing account, and no mapping library, which the dependency list does
  not bless and which would put hundreds of kilobytes in front of a customer on
  a phone to draw a dot.
- **The driver's phone reports its own position** through a small client
  component and a server action, authorised by the driver's session rather than
  an ingest token that would have to live on a phone that gets lost.
- `embedUrl`, `boundsFor` and `navigationLink` are pure and tested, including
  that a single stop does not frame the whole planet.

**Decided, and why:**

- **An iframe, not a map library.** The blessed list has no renderer, and the
  Maps Embed API needs the billing account §6.1 assumes and this app lacks.
- **Every caption carries the coordinates and a link out.** OSM answers a
  request without a proper referer with a blank 103-byte tile, so a map that
  fails must still say where the vehicle is.
- **Location sharing is foreground-only, and says so.** §6.3 wants a
  `ForegroundService` at ten-second intervals; a web page stops running when
  the screen locks. Claiming background tracking would be the dishonest option.

**Not verified:** tiles were blank in the automation browser used to check.
The embed's structure renders and OSM serves a real 6.9 KB tile to a request
carrying an `openstreetmap.org` referer — which is what the iframe sends — but
somebody should open `/track/<token>` in an ordinary browser before the soft
launch. Recorded in ARCHITECTURE.md rather than assumed away.

---

## Map tiles confirmed — 11 August 2026

**Asked:** nothing; the operator checked the tracking link and reported that
the map loads.

**Changed:** `docs/ARCHITECTURE.md` only. The Known-gaps entry claiming the
tiles were unverified is now a statement that they render, with the date and
who checked, and the blank tiles are attributed to the automation browser
rather than to the embed.

**Why it is worth a commit:** a stale caveat is worse than none. The next
session reading "unverified in production" would either re-do the check or,
worse, design around a limitation that does not exist — and the coordinates in
every caption might have looked like scaffolding to remove rather than the
deliberate fallback they are.

---

## Closing the open list — 11 August 2026

**Asked:** merge everything outstanding, finish the open items, add vehicle
photo upload, give operators a way to add and remove vehicles, and rewrite the
README so an agent or a developer can pick this up cold. Plus: Indian customers
want a number to call before they commit.

**Changed:**

- **Operators run their own fleet.** Add a vehicle, retire one, file documents,
  upload or link photographs. A vehicle they add lands `pending_verification`
  and they cannot verify their own paperwork — self-certification would hollow
  out the rule the whole marketplace rests on. Removing retires rather than
  deletes, because bookings and settlements still refer to it.
- **Standing rates are editable** at `/partner/rates`, validated the same way a
  typed quote is: a rate with no minimum km per day would produce instant
  offers hiding the charge §7.1 singles out, and worse, nobody would be reading
  it before it sold.
- **Instant booking crosses state lines**, with the AITP requirement tightening
  the filter rather than surprising anyone at a check post.
- **Photo upload** by presigned S3 PUT, so the image never passes through a
  function billed by the millisecond. SigV4 written by hand — no SDK is
  blessed — and pure, so it is tested.
- **Contact details.** Toli's number, WhatsApp and email on the front page, the
  tracking link and every trip; the operator's released once a booking exists.
- **The deeper portal strings** exist in all six languages.
- **README rewritten** for the two readers who arrive cold: it now opens with
  where the logic lives, which document answers what, and what to read first.

**Decided, and why:**

- **Toli's number is public; the operator's waits for a booking.** §10's
  masking is about *when*, not whether. Refusing to publish any number would
  read as having nobody behind the marketplace, which in this market loses the
  customer before the price does.
- **Photos link when storage is unconfigured.** An empty gallery helps nobody;
  a linked photo is worth more than a missing one, and §4.1 asks for real
  vehicles rather than for a particular hosting arrangement.

**Not done, and not claimable:** the `hi`/`te`/`ml`/`kn` translations still
have no native-speaker review. I wrote them; I cannot also be the reviewer, and
saying otherwise would be the kind of claim this log exists to prevent.

**Not merged, deliberately:** PR #4, an `@claude` branch from before this
session — a parallel implementation of the whole app with its own README,
stylesheet and routes at the old paths. Merging it would overwrite the console,
portal, partner and driver surfaces with an earlier attempt. Raised rather than
merged.

---

## The rebrand — 11 August 2026

**Asked:** a modern, Uber-calibre redesign an investor would read as a
professional team; a logo; editorial illustration on the home page; avatars,
with direct upload rather than URLs.

**Changed:**

- **A `toli` theme** in the token package — ink on paper, one bold weight,
  colour reserved for meaning — and the whole app re-skinned from it, which is
  the payoff of every component having been token-driven from the start. The
  console, portal, partner, driver, login and tracking surfaces all moved
  together without an edit each.
- **A logo**: dot, road, pin — one trip, one stroke, drawn in currentColor so
  the same component is ink in the header and paper in the footer. Favicon to
  match.
- **The hero** is a hand-drawn animated SVG of the Madurai–Kodaikanal ghat
  road — bus bobbing, wheels turning, road dashes moving, clouds drifting,
  destination pin pulsing — with the live tracking card floating over it. A
  few kilobytes, no library, stilled by prefers-reduced-motion.
- **An ink metrics band and a black footer**, Uber-school; sticky masthead.
- **Avatars** (migration `0008`): presigned upload, initials as the designed
  default, shown in every masthead; `/account` as the one page every role
  shares, holding face, language and sign out.

**Decided, and why:**

- **The illustration's palette is the one exception to tokens-only CSS.** It
  is artwork with the standing of a photograph; the UI around it stays
  monochrome precisely so the world the product operates in is the only
  colourful thing on the page.
- **No mapping or drawing library, no webfont.** The scene is SVG, the type is
  a system stack tuned Helvetica-ward. The blessed-dependency list is intact.
- **No URL field for avatars**, as asked: upload or initials.

**Found while verifying in the browser, not the diff:** the demo card sat
exactly on top of the bus and gopuram (moved to the sky); the headline set at
5xl stacked four lines (dropped to 4xl); the sticky masthead had no background
and content scrolled through it; and sign-in failed outright because the user
query now selects avatar columns migration `0008` had not yet created in
production — applied, additive, exactly what the deploy would have run.

Also visible while signed in as the driver: a third party had made a real
instant booking on production that morning. The seed data is no longer alone.

**Open:** avatar upload reports "not configured" on production until the four
S3 variables are set; the hero scene is one static composition and could grow
a night mode; `hi`/`te`/`ml`/`kn` strings still lack a native pass.

## Session 15 — 11 August 2026: registration, an accent of its own, two more scenes

**Asked:** fix the dropdowns (raw OS chrome, sentence-length options); the
language row overflowing its card on `/account`; add a way to register as a
new customer, operator or driver — "bring right workflow"; more illustrations
like the hero; and make the design stop reading as an Uber copy.

**Changed:**

- **Selects are now drawn by the app, not the OS**: `appearance: none`, our
  border and radius, and a chevron built from two gradients in the muted token
  — no image asset, no literal colour. Options stopped carrying paragraphs:
  segments say `Premium — AC` (new `short` field beside `promise`), vehicle
  classes say `9–26 seats` (new `seatRange`). List-style selects keep no
  chevron, because they have no popup to promise.
- **Registration, three shapes on purpose.** `/register` mirrors sign-in:
  who are you, then the form. A customer self-serves and lands signed-in in
  the portal. An operator *applies* — created `pending_verification`, in the
  partner app immediately, sellable only after ops verifies, which is
  machinery that already existed. A driver gets no form: `/partner/team` is
  where their operator adds them and issues their sign-in — synthetic email
  from their phone (`d<10 digits>@drivers.toli.in`, an identifier, not a
  mailbox), generated password shown exactly once, stored only as a hash.
- **The accent became terracotta** — the colour the hero's gopuram already
  wore — in one token change. Buttons, links, eyebrows, chips and step
  numbers all warmed together; ink stays for type, green and red keep their
  meanings. This is the de-Uber move: same discipline, different owner.
- **Two more hand-drawn scenes**: the Pamban bridge (bus crossing on a slow
  loop, gulls, lapping waves) above "How it works", and a night sleeper coach
  (lit berth windows, headlight beam, twinkling stars) with the fleet owners.
  Same artwork-palette exception as the hero.
- The landing page, login chooser and both login forms now point new arrivals
  at `/register`; the account card and language row wrap instead of clipping.

**Decided, and why:**

- **Drivers do not self-register.** §3's warning is the whole marketplace: a
  driver is somebody's employee with police verification behind them, not a
  stranger with a form. The "right workflow" the user asked for is the
  operator issuing credentials, so that is the only door.
- **A phone number that already exists refuses to register.** Claiming an
  ops-created customer row online with nothing but a known phone number would
  be account takeover of their trip history; linking stays a human's job
  until OTP exists.
- **No `revalidatePath` after issuing a driver login** — found live: the
  refresh replaced the client component holding the password (the only copy
  that will ever exist) with the server's "login exists" markup. The panel
  now survives until the operator navigates away.

**Verified in a real browser against a throwaway Neon branch** (created and
deleted the same hour): customer registration → signed in → portal;
operator application → partner app; driver added, sign-in issued, and that
driver's credentials signed into `/drive` — the full three-role loop.
Also found on screen, not in the diff: the register chooser's call-to-action
lines rendered muted (`.pick-card span` outranked `.pick-go`), and the team
form's fieldset wore the browser's default frame with its hint run into the
legend. Both fixed.

**Open:** password reset is still a call to Toli ops; the operator
application has no notification to ops beyond appearing in the verification
queue; `hi`/`te`/`ml`/`kn` strings still await a native speaker; S3 variables
still unset on production for avatar and vehicle-photo upload.

## Session 16 — 11 August 2026: navy, and scenes that are of somewhere

**Asked:** the black-and-white theme still reads as Uber — change it to dark
blue and white; and make the images suit south Tamil Nadu — temple tower,
mountains.

**Changed:**

- **Foreground token: black → deep navy** (`#122a52` light, navy-tinted
  surfaces/borders/muted to match; dark scheme is white-on-navy). One token
  edit repainted the masthead, footer, metrics band, buttons, logo and every
  heading — the same payoff as the first re-skin, proving the point of the
  token system twice.
- **The hero gopuram grew into a Meenakshi-class tower**: six striped tiers,
  sculpture-niche rows, barrel roof, a crown of kalasam finials, arched
  gateway — and behind it two hazed ranges of actual Western Ghats peaks,
  because Kodaikanal sits on a mountain, not a mound.
- **Pamban gained its destination**: the bridge now ends at a Rameswaram
  shore with its own small gopuram and palm, so each crossing ends with the
  bus disappearing into temple town instead of off an edge.
- **The night scene gained Palani**: the hilltop temple lit above the ridge,
  glow, lamp-lit steps — the way you actually see it from a night bus.
- The scene's destination pin matched to the logo's navy.

**Found while verifying in the browser, not the diff:** the taller gopuram
was entirely hidden behind the floating demo card, which covered the left
half of the artwork — the two things the scene exists to show. The card
moved to overhang the bottom-right corner, where it costs a palm tree; a
second look showed its corner clipping the destination pin, so it now hangs
below the frame edge too.

Verification note: the landing page was viewed via `localhost` because the
browser held a driver session cookie for `127.0.0.1` from the previous
session's testing — httpOnly, so undeletable from script, but host-scoped,
so the other hostname sidesteps it. No database was needed; `publicSettings()`
fallback carried the page, which is exactly what it is for.

**Open:** unchanged from session 15 — S3 variables, native-speaker pass,
password reset by phone call.

## Session 16b — 11 August 2026: S3 switched on, and the bug it flushed out

**Asked:** set the S3 variables so photo upload works.

**Changed / provisioned:**

- Bucket `toli-media-vinothkannan`, `ap-south-1` (Mumbai — the app's users
  are in India). Public read on exactly `avatars/*` and `vehicles/*`; writes
  are presigned-only; ACLs stay blocked; CORS allows PUT/GET from the
  production origin, `*.vercel.app` previews and localhost dev. All of it
  done over curl's `--aws-sigv4` — no AWS SDK, no CLI, matching the app's own
  hand-signed posture. The four variables set on Vercel (production and
  preview) and production redeployed.
- **Deletion commands were executed before being recorded**: a throwaway
  bucket was created, filled, emptied and deleted with the same command
  shape, per the never-print-an-untested-cleanup-command rule.

**The bug this flushed out — `session.user.id` was undefined everywhere.**
The session callback mapped role, operatorId, driverId and customerId onto
the session but never `token.sub` → `session.user.id`, and NextAuth v5 does
not do it for you. Nothing ever noticed: every existing flow reads the role
or a link id, and `avatarUrlFor(undefined)` silently returns initials. The
first real avatar upload on production bounced a perfectly valid session to
/login, because the avatar actions are the only code that needs the id
itself. Fixed with one line in the session callback and a regression test
that pins the mapping (203 unit tests now). The upload then worked
end-to-end in a browser: presign → CORS preflight → PUT to Mumbai → public
GET → face rendered.

**Also found:** the bucket's CORS is origin-exact — the local verify server
on port 3703 needed its own entry, a reminder that "CORS works" is only ever
true per-origin.

**Test accounts created while verifying, both harmless and disclosed:**
`s3check@toli.in` (customer, on production) and `s3local@toli.in` (customer,
on a throwaway Neon branch deleted the same hour).

**Open:** native-speaker pass on hi/te/ml/kn; password reset is still a
phone call; stale PR #4 remains for the operator to close.
