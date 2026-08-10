# toli — architecture

How this app works, in its current form. Rewritten whenever the design
changes, so it describes the present rather than accumulating history —
that is SESSIONS.md's job.

## Purpose

India's aggregator marketplace for chartered vans, tempo travellers and buses — transparent quotes, verified operators, live tracking.

In its current form the app is the **charter desk**: the internal surface where
a single operator takes group enquiries, prices them against verified transport
companies, turns an accepted quote into a booking, runs the trip, and settles
the money. The customer-facing and operator-facing surfaces described in §3 of
the plan do not exist yet, and cannot exist under the template's single-user
gate without a real user store.

## Domain model

- **Enquiry** — a group that wants a vehicle: origin, destination, departure
  instant, trip type, days, passengers, estimated distance, class wanted. It is
  `new`, then `quoted`, then `won`, `lost` or `cancelled`.
- **Transport operator** — a transport company. Supply. Starts `pending`,
  becomes `verified` or `suspended`. Only a verified operator may be quoted;
  this is the marketplace's actual product, so it is a rule in code rather than
  an ops habit.
- **Vehicle** — one chartered vehicle belonging to an operator, with a class,
  seats, permit type and expiry, and optionally the operator's own per-km rate.
  A null rate means "quote at the class rate", not "free".
- **Quote** — one operator's price for one enquiry, stored as a full fare
  breakdown. `draft` → `sent` → `accepted` / `declined` / `expired`.
- **Booking** — an accepted quote and the trip it became. `confirmed` →
  `on_trip` → `completed`, or `cancelled` from either. It never moves back.
- **Payment** — one movement of money against a booking: an advance or balance
  from the customer, a payout to the operator, or a refund. Balances are
  derived from these, never stored.

The path is: enquiry → several quotes → one accepted → booking → payments.
Nothing skips a step; an enquiry cannot become a booking without a priced
quote, which is exactly the dispute the marketplace exists to prevent.

## Data model

All money is integer **paise**. Every table below was introduced by
`0001_toli_marketplace`; `audit_log` came from `0000_audit_log`.

| Table | Shape and why |
|---|---|
| `audit_log` | Append-only events: sign-ins plus every enquiry, quote, booking, payment and operator change. The only record of *who did what when*; everything else is current state. |
| `transport_operator` | `name`, `city`, `contact_name`, `phone`, nullable `gstin`, `status`, `commission_bps`, `notes`. Named `transport_operator` because "the operator" in this codebase already means the human who signs in. Commission is per-operator: take rates get negotiated. |
| `vehicle` | `operator_id`, `registration` (**unique**), `class`, `seats`, `model`, `ac`, `permit_type`, `permit_expiry` (date, not instant), nullable `per_km_paise`, `active`. A duplicate registration is either a typo or the same vehicle listed twice — both worth refusing. |
| `enquiry` | Customer contact, `origin`, `destination`, `trip_type`, `start_at`, `days`, `passengers`, `estimated_km`, `vehicle_class`, `status`, unique human `ref`. |
| `quote` | `enquiry_id`, `operator_id`, nullable `vehicle_id`, and **every component of the fare**: per-km rate, chargeable km, base fare, driver allowance, night halt, tolls, subtotal, GST rate and amount, total, commission rate and amount, operator payout. Plus `status` and `valid_until`. |
| `booking` | `quote_id` (**unique**), `enquiry_id`, `status`, driver name/phone, actual `vehicle_registration`, `pickup_note`, `confirmed_at`, `completed_at`, `cancellation_reason`, unique human `ref`. |
| `payment` | `booking_id`, `kind`, `amount_paise`, `method`, `reference`, `note`, `at`. A ledger, not a balance. |

Two shapes carry real weight:

- **The quote stores its whole breakdown and is never recomputed.** Rate cards
  move. A price a customer was given has to stay explainable line by line six
  months later, when the card it came from no longer exists.
- **`booking.quote_id` is unique.** That index is what refuses a
  double-clicked "accept" — not application logic, which would race.

Statuses are `text` with a TypeScript `$type<>`, not Postgres enums: the
vocabularies still move, and adding a value should not need a migration that
locks a table.

## Surfaces

Everything is behind the operator gate. The proxy is closed by default — a new
route is protected because it exists.

| Route | What it is for |
|---|---|
| `/` | The desk. Trips that departed and are still open, next departures, then the totals. |
| `/enquiries` | Open enquiries by default, filterable by status. |
| `/enquiries/new` | Take an enquiry, usually while the customer is on the phone. |
| `/enquiries/[id]` | The trip, the quote builder (every quotable vehicle priced for *this* trip), and every quote with its full breakdown and actions. |
| `/operators`, `/operators/[id]` | Onboard and verify companies; list, rate and retire their vehicles. |
| `/bookings`, `/bookings/[id]` | Live bookings by departure; per booking: fare, money position, driver assignment, status moves, payment ledger. |
| `/login` | The template's gate, outside the `(app)` route group. |

Server actions, all form posts, all validated with zod, all writing an audit
row: `createEnquiryAction`, `createQuoteAction`, `sendQuoteAction`,
`acceptQuoteAction`, `declineQuoteAction`, `markEnquiryLostAction`,
`createOperatorAction`, `setOperatorStatusAction`, `createVehicleAction`,
`setVehicleActiveAction`, `assignDriverAction`, `setBookingStatusAction`,
`recordPaymentAction`.

There is no client JavaScript. Everything is a server component and a plain
form; anything that would need state in the browser is a feature that has not
been thought through yet.

## External services

| Service | Configured by | Notes |
|---|---|---|
| Neon Postgres | `DATABASE_URL` | Via Drizzle over the neon-http driver. Read lazily; `next build` needs no database. |
| NextAuth | `AUTH_SECRET`, `WERFT_USER_EMAIL`, `WERFT_PASSWORD_HASH` | One operator, credentials only, JWT session. |
| Kompass gateway | `KOMPASS_BASE_URL`, `KOMPASS_TOKEN` | Available via `src/kompass.ts`, **currently unused** — no feature here needs a model. |

## Decisions in force

- **Money is integer paise, everywhere.** A fare is a rate times a distance,
  then split into commission and payout: three chances for a float to lose a
  paisa and stop the operator's settlement reconciling. `applyBps` is the only
  place a rounding happens.
- **Commission is taken on the fare excluding GST.** The tax is collected on
  the operator's behalf and passed on; taking a cut of it would be charging the
  operator for their own tax. The test that catches a regression here asserts
  commission is identical under both GST regimes.
- **GST is a stored choice, not a looked-up rate.** 5% without input tax credit
  or 12% with it (§8.3) — which is better depends on the operator's own input
  costs, so the rate lives on each quote. Needs a CA's sign-off before it
  drives a real invoice.
- **A daily kilometre floor applies to every trip type except a one-way drop.**
  On a drop the vehicle is released at the destination and the operator prices
  the empty return into their per-km rate; charging a 250 km floor on an 80 km
  drop would double-count it.
- **Times are IST, explicitly.** `datetime-local` gives no offset and the
  server runs UTC. Parsing and formatting both state `Asia/Kolkata`, so the app
  behaves the same on a laptop in Chennai and on Vercel.
- **Only verified operators can be quoted**, enforced in the query that feeds
  the quote builder rather than by a check after the fact — an unverifiable
  option is never offered in the first place.
- **Accept order is the safety mechanism.** The neon-http driver has no
  interactive transactions. Accepting writes the booking first (protected by
  the unique index), then the quote, the losing quotes, and the enquiry. A
  failure part-way leaves a visible booking rather than losing the customer's
  confirmation.
- **The root layout reads nothing.** The 404 page is prerendered against it and
  `next build` must succeed with no `AUTH_SECRET` and no database, so the
  signed-in chrome lives in the `(app)` route group's layout instead.
- **Human-quotable references** (`TL-260810-K4P2`) alongside UUIDs, in an
  alphabet with no vowels and no 0/O/1/I. Nobody reads a UUID to a driver.

## Known gaps

- **No routing or maps (§6).** `estimated_km` is typed in by hand. This is the
  single largest source of pricing error, and the most valuable next change: a
  distance provider fills the field, and the quote builder stops depending on
  the desk's memory. Nothing else in the schema has to change.
- **No customer or operator surfaces (§3).** The single-user gate is the
  blocker, not the code. Both would need a real user store, which AGENTS.md
  says is a decision to raise rather than implement.
- **No payment gateway, no invoices, no GST filing.** Payments are recorded
  after the fact. §8.3 and §8.4 need professional advice first.
- **Quotes do not expire on their own.** `valid_until` is stored and shown, but
  nothing sweeps them to `expired` — that wants a scheduled job, and a nightly
  workflow is a bigger commitment than the value it adds today.
- **`money_position` recomputes from the full payment list per booking.** Fine
  at a desk's volume, wrong at a marketplace's; it becomes an aggregate query
  when a booking has hundreds of movements, which today it never does.
- **Money columns are `integer`**, capping a single booking at about ₹2.1
  crore. Far beyond a single charter; worth remembering before anyone models a
  fleet contract as one booking.
- **No pagination anywhere.** Lists are filtered by status and that is all.
  The first time a list is genuinely long, this is the thing that will hurt.
- **The rate cards in `domain/vehicles.ts` are indicative national defaults**,
  not a researched price list. They are a starting point that per-vehicle rates
  override, and they should be replaced with real numbers before anyone quotes
  a stranger.
