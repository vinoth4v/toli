# toli — architecture

How this app works, in its current form. Rewritten whenever the design
changes, so it describes the present rather than accumulating history —
that is SESSIONS.md's job.

## Purpose

An aggregator marketplace for chartered vans, tempo travellers and buses in
India: a group takes the whole vehicle, with a driver, for a duration.

What is built is the **desk** — Toli Admin — running **Lane A, Assisted RFQ**:
a requirement is posted, matched operators are identified, their quotes are
recorded in one structure, compared on landed cost, and one is awarded. Lane B
(instant book) and Lane C (recurring contracts) are not built and are not
scaffolded for; both depend on the price data Lane A produces.

The transaction this app is shaped around is not a ride. Booking horizons run
from three days to three months, the unit sold is a vehicle rather than a seat,
the price is negotiated rather than computed, and a cancellation costs a
wedding ₹15,000. That is why the heart of the app is a quote-and-award engine
and not a dispatch algorithm.

## Domain model

- **Operator** — a fleet business, typically four to thirty vehicles, run by an
  owner and a dispatcher. Not a gig driver, and *not a user*: no operator signs
  in. Carries a verification flag and its own commission in basis points.
- **Vehicle** — one vehicle in an operator's fleet: class, seats, registration,
  model year, air conditioning, and whether it is on the road.
- **Charter request** — a requirement. Customer contact, segment, starting
  city, itinerary prose, first and last day, passengers, vehicle class and
  count, and the desk's own running-kilometre estimate. Carries a human-facing
  serial reference because that number is read down a phone line.
- **Quote** — one operator's answer, always as the same seven components: base
  fare, kilometres included, per-kilometre rate beyond that, driver bata per
  day, night halt per night, and tolls, parking and interstate permit — each of
  those three either included in the fare or charged on top.
- **Booking** — an awarded quote, with all-in, advance and commission frozen at
  the moment of the award.
- **Audit event** — append-only, and the only history the desk has.

Relationships: an operator has many vehicles and many quotes; a request has
many quotes and at most one booking; a booking points at the request, the quote
and the operator.

**Toli Fair Price** is the piece of domain logic worth naming. Two spoken
quotes are almost never comparable — the allowances differ, and the extras that
go unmentioned are exactly the ones that appear on the day. Every quote is
therefore priced against *this trip's* days, nights, kilometres and passenger
count, producing one landed cost plus an itemised breakdown. That normalisation
lives in `src/lib/pricing.ts` and is the most heavily tested code in the repo.

## Data model

Introduced by migration `0001_toli_marketplace`, alongside `audit_log` from
`0000_audit_log`.

| Table | Shape and why |
|---|---|
| `operator` | Name, contact, phone, city, GSTIN, `verified`, `commission_bps`, notes. Commission is per operator, not global, because "less than the agent's 15–25%" is negotiated one operator at a time and the promised number has to survive the conversation. |
| `vehicle` | Belongs to an operator (cascade). Class, seats, registration, model year, AC, `active`. Class and seats are what matching reads; the registration is what a customer is told at 4 AM. |
| `charter_request` | `reference` is a `serial` alongside the uuid primary key — a uuid cannot be read aloud. Dates are `date`, not timestamps: a vehicle booked for the 3rd is booked for the 3rd in Jaipur, whatever region the function ran in. `estimated_km` belongs to the desk, not to any operator, which is what stops each quote defining its own yardstick. |
| `quote` | The seven components as integers plus three `*_included` booleans. Excluded amounts are still stored — an operator's toll estimate is information even when the customer pays it — and the pricing code adds an included extra as zero while still showing the line. |
| `booking` | Copies of `all_in_paise`, `advance_paise`, `commission_paise`. A unique index on `request_id` makes a double award impossible at the database rather than in a handler. |
| `audit_log` | Unchanged from the template; the app added seven event kinds. |

**Money is integer paise everywhere.** Rupee floats accumulate error the moment
a commission percentage touches them. Rupees exist only at the two edges —
`parseRupees` on the way in, `formatInr` on the way out — both in
`src/lib/money.ts`, both tested.

Vocabularies (vehicle class, segment, statuses) are `text` columns rather than
Postgres enums, so adding a class is a deploy rather than a migration that
locks a table. The cost is that the database will not reject a bad value, so
every write goes through the type guards in `src/lib/catalog.ts`.

## Surfaces

Everything is behind the operator gate — the template's proxy closes every
route that is not explicitly exempted, and nothing new was exempted.

| Route | For |
|---|---|
| `/` | The desk: open requirements, quotes awaiting a decision, supply against the launch target, booked value and commission, and the confirmed trips. |
| `/requests` | Every requirement, newest first. |
| `/requests/new` | Post a requirement. |
| `/requests/[id]` | The RFQ itself: trip detail, Toli Fair Price ranking with per-quote breakdown and award, matched operators, and the form that records a quote. |
| `/operators` | The supply list, and the form that signs an operator. |
| `/operators/[id]` | One operator: fleet, verification, adding and grounding vehicles. |
| `/bookings` | Awarded trips; mark done or cancelled. |
| `/login`, `/api/auth/*` | The template's gate. The only routes reachable without a session. |

Server actions, all of them `"use server"` and all reached from forms:
`createOperatorAction`, `setVerifiedAction`, `addVehicleAction`,
`setVehicleActiveAction` (`src/app/operators/actions.ts`);
`createRequestAction`, `recordQuoteAction`, `awardQuoteAction`,
`cancelRequestAction`, `setBookingStatusAction`
(`src/app/requests/actions.ts`).

Every page is `force-dynamic`: they read the session cookie and the database,
and there is nothing to prerender.

There is no API surface. Nothing outside the app calls it.

## External services

| Service | Configured by | Notes |
|---|---|---|
| Neon Postgres | `DATABASE_URL` | Read on first use, never at module scope, so `next build` works without it. |
| Auth.js session | `AUTH_SECRET`, `WERFT_USER_EMAIL`, `WERFT_PASSWORD_HASH` | One operator. |
| Kompass gateway | `KOMPASS_BASE_URL`, `KOMPASS_TOKEN` | Present from the template and **unused** — this app calls no model. |

No payment gateway, no messaging provider, no maps or distance API. The running
kilometre estimate is typed in by the desk.

## Decisions in force

- **RFQ, not dispatch.** Building an Uber-shaped instant-booking flow first
  would have meant inventing prices before there was any data about them. The
  quote-and-award engine both serves the customer and collects the dataset that
  makes Lane B possible later.
- **Assisted, not self-serve.** Operators do not sign in, so quotes are typed
  in by the desk from a phone call or a WhatsApp message. This is a consequence
  of the single-identity gate, and it is also correct for the stage: the
  structure of the quote is the product, and forty operators are faster to
  serve by hand than to onboard onto software.
- **One shared kilometre estimate per requirement.** The desk's number, applied
  to every quote. Letting each operator supply its own would make the
  comparison meaningless.
- **An included extra is priced at zero but still shown.** "Tolls: included"
  and "tolls: ₹0" are different claims, and a customer is entitled to see which
  one they were given.
- **Booking totals are copied, not recomputed.** A change to how pricing works
  must never restate a trip somebody has already paid an advance on.
- **Award order is the safety.** The `neon-http` driver has no multi-statement
  transaction, so the booking row — with its unique index on `request_id` — is
  written first. A double click hits the constraint; everything after it is a
  status the desk can see and correct.
- **Partial matches are kept and labelled.** An operator with two of the three
  coaches needed is exactly who the desk wants to call. Hiding them would be a
  tidier list and a worse marketplace.
- **Matching is explainable, not scored.** Same city, class at least as big,
  seats. When the desk asks why an operator was skipped, the answer is one
  sentence.
- **Money in paise, tested at the edges.** See the data model.
- **Migration `0001` was written by hand.** `pnpm db:generate` could not run in
  the session that created it — see SESSIONS.md — so the SQL, the journal entry
  and the snapshot were written to match drizzle-kit's own output. The next
  session to change the schema should confirm `pnpm db:generate` produces no
  spurious diff before adding to it.

## Known gaps

- **No customer or operator surface.** Adding one means a real user store, and
  that is a decision to raise rather than to implement.
- **No fan-out.** The app identifies who to contact; a human contacts them. SMS
  and WhatsApp are the obvious next step and are not started.
- **No payments.** The advance is a number, not a link. No gateway, no
  settlement run, no GST invoice — the corporate segment will need the invoice
  before it will need anything else.
- **No distance service.** `estimated_km` is typed in, so a careless estimate
  skews every quote on that requirement equally. Equally is the saving grace;
  it still misprices the trip.
- **Quote status is only ever set by an award.** There is no "operator
  withdrew" path, and a quote cannot be edited — record a second one.
- **No pagination anywhere.** Every list loads in full. Correct for one city
  and one desk; wrong by the second city.
- **No seed or demo data.** A fresh deployment is genuinely empty.
- **Unit tests do not run in CI.** `pr-checks.yml` gates on gitleaks,
  typecheck, build, the Neon preview branch and the preview smoke test —
  `pnpm test` is not among them, so the pricing suite only protects a human who
  runs it. Adding a test job to that workflow is the obvious fix.
