# toli

India's aggregator marketplace for chartered vans, tempo travellers and buses — transparent quotes, verified operators, live tracking.

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).
> The hard rules live in `AGENTS.md`, the design in `docs/ARCHITECTURE.md`,
> and why each change was made in `docs/SESSIONS.md`.
> The business plan this implements is `docs/00-index.md` and its five parts.

## What it does

Toli is an **ops console for running a charter marketplace by hand** — the tool
for the plan's Phase 0 and Phase 1, where a person on a desk beats an algorithm
and fifty real bookings teach you more than six months of design.

You can, today:

- **Take a requirement** from a group organiser — trip type, route and stops,
  dates, passenger count, vehicle class, AC, extras, and the states the trip
  crosses — and get back a referenced RFQ.
- **Fan it out** to chosen operators. Inviting one records the moment they were
  asked, which is what makes the response rate a real number rather than a
  flattering one.
- **Record each operator's quote in one fixed schema**: per-km rate, minimum km
  per day, driver bata, night halt, and whether toll, parking and interstate
  permit tax are in or out. The console refuses a quote that leaves the
  minimum-km-per-day blank, because that blank is where an extra ₹13,000 hides.
- **Compare quotes side by side** — the same inclusion chips in the same order
  on every card, an estimated total, and an honest worst case that itemises
  what each exclusion could add. Once there are five comparable past quotes, a
  Toli Fair Price band appears above them.
- **Accept one and book it.** The agreed total, commission rate and tax
  treatment are frozen onto the booking at that moment.
- **Take payment** — UPI, card, netbanking, NEFT, or cash collected by the
  driver, which is modelled properly and deducted from what the operator is
  paid.
- **Assign a vehicle and driver**, and be refused when the paperwork says no:
  an expired fitness certificate blocks the assignment, and an interstate trip
  needs a valid All India Tourist Permit on a vehicle inside the twelve-year
  age limit.
- **Run the trip** — dispatch, start with odometer, stops, deviations, SOS,
  completion, road expenses, and positions.
- **Share a public tracking link** that needs no app and no login. Sixty
  wedding guests can open it; none of them sees a price, a phone number or an
  SOS event.
- **Issue a GST invoice** with the CGST/SGST or IGST split decided by the place
  of supply, and **settle the operator**: commission, TCS, TDS, expenses
  reimbursed, cash already collected, net payable.
- **Watch the fleet's compliance** — a queue ordered by consequence, with the
  30/15/7-day expiry ladder and hard suspension for a lapsed permit or
  insurance.
- **See the metrics that matter** — quote response rate first, because below
  50% nothing else does.

Every rupee is stored as integer paise, every timestamp as UTC and rendered in
IST, and every action that moves money is written to an audit log.

## What works, and what does not

**Works:** everything in the list above, against a Postgres database, behind
the single-operator gate. The pricing engine, GST split, settlement arithmetic,
compliance rules, fair-price band and metric definitions are pure functions
with unit tests — 91 of them.

**Does not, deliberately:**

- **No customer, operator or driver apps.** The plan's five surfaces are
  Flutter and Kotlin work. This is surface 5, the admin console, and it is the
  one that makes the other four unnecessary for the first two hundred bookings.
- **No government API verification.** VAHAN, Sarathi and GSTIN access goes
  through an authorised aggregator and is a Month-2 item. An ops person reads
  the portal and records what it said — into the same table the automated check
  will write to.
- **No payment gateway.** Payments are recorded, not taken. Razorpay Route or
  Cashfree Easy Split is the Phase 1 integration; the schema already models
  advance, balance, refund and cash-to-driver.
- **No maps, geocoding or routing.** Stops are text and distance is estimated
  by the person taking the call. Self-hosted OSRM is the plan's answer and it
  is a service, not a page.
- **No WhatsApp, SMS or push.** Notifications are the ops desk's own phone.
- **No live GPS ingest.** Positions are recorded by hand or, later, by the
  driver app and an AIS-140 VLTD feed.
- **One user.** The gate is one email and one password hash. Real RBAC over the
  admin console is a decision to raise, not to implement quietly.

## Run it

```bash
pnpm install
pnpm db:migrate          # needs DATABASE_URL
pnpm db:seed             # realistic Jaipur data — never against production
pnpm dev
```

Environment lives in `apps/web/.env.local`; `apps/web/.env.example` lists what
is needed. `pnpm hash-password` sets the operator password — an app with none
cannot be signed into.

## Change it

Say what you want in the app's page on the
[marketplace](https://werft-marketplace.vercel.app), or comment `@claude` on an
issue here. Either way Claude works on a branch and opens a pull request; five
gates run against a real preview on its own database branch, and a human
merges. Nothing reaches production on its own.

## Deployment

Merging to `main` deploys. Migrations are applied to production during that
build, before it starts — a failed migration fails the build and the previous
deployment keeps serving.
