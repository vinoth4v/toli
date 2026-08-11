# toli

India's aggregator marketplace for chartered vans, tempo travellers and buses — transparent quotes, verified operators, live tracking.

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).
> The hard rules live in `AGENTS.md`, the design in `docs/ARCHITECTURE.md`,
> and why each change was made in `docs/SESSIONS.md`.
> The business plan this implements is `docs/00-index.md` and its five parts.

## What it does

**Four people, four applications.** §3 of the plan needs genuinely different
users — Toli's ops desk, the group organiser, the fleet operator and the
driver — and is explicit that the driver must not be the operator, because a
driver who can see commercial terms can take the customer off-platform. So each
role signs in to its own surface, and the rules live in one tested module:

| Role | Lands on | What it is |
|---|---|---|
| `admin` | `/console` | The ops console: verification, matching, disputes, payouts |
| `customer` | `/portal` | Calm and consumer-facing: ask, compare, book, track |
| `operator` | `/partner` | A work tool: quote inbox, fleet paperwork, earnings |
| `driver` | `/drive` | Three big buttons, a bad phone — and **no money on any screen** |

A signed-in person who types another surface's URL is redirected to their own,
at the edge, before the page renders. Every query about "my" data goes through
`src/data/scoped.ts`, which puts ownership in the WHERE clause.

**`/` is the marketplace's public front page** — what the business is, the
comparison that explains why it exists, the fleet it runs and the terms
operators get. Signed in, it redirects straight to `/console`, so the operator
never clicks past a welcome page to reach their own app.

Behind the gate, `/console` is an **ops console for running a charter
marketplace by hand** — the tool for the plan's Phase 0 and Phase 1, where a
person on a desk beats an algorithm and fifty real bookings teach you more than
six months of design.

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
compliance rules, fair-price band, metric definitions, Indian identifier
checks and the geo maths are pure functions with unit tests — 150 of them.

**Also works — position ingest**, which needs no third party:

- `POST /api/ingest/ping` for a driver app, single or replayed batch, with an
  offline buffer in mind.
- `POST /api/ingest/vltd` for an AIS-140 telematics feed, tolerant of the field
  names real Indian vendors actually send. This is what keeps tracking alive
  when the driver's phone dies, which it will.
- Each device gets its own bearer token; only its SHA-256 is stored. A position
  outside India, or Null Island from a chip with no fix, is refused. A vehicle
  far from every planned stop raises one deviation event, not two hundred.

**Built but not switched on** — each needs an account nobody has opened yet.
Every one degrades to the manual path that worked before, says which variable
is missing, and never pretends. `/integrations` is the live inventory:

| Integration | Turns on with | Meanwhile |
|---|---|---|
| Razorpay payment links + webhook | `RAZORPAY_*` | Payments recorded by hand once the money lands |
| Google Places + Mappls geocoding | `GOOGLE_MAPS_API_KEY` / `MAPPLS_REST_KEY` | Stops stay text; coordinates typed when needed |
| Self-hosted OSRM routing | `OSRM_BASE_URL` | Estimated km typed by whoever took the call |
| WhatsApp Business | `WHATSAPP_*` | Messages queue in the outbox to send by hand |
| VAHAN / Sarathi / GSTN | `VEHICLE_VERIFY_*` | An ops person reads the portal, same table, slower |

**Does not exist at all:**

- **No customer, operator or driver apps.** The plan's five surfaces are
  Flutter and Kotlin work. This is surface 5, the admin console, and it is the
  one that makes the other four unnecessary for the first two hundred bookings.
- **No map rendering.** Coordinates deep-link out to Google Maps, per the
  plan's own advice not to build navigation. Drawing tiles in-app would mean a
  dependency this template does not bless.
- **No cloud-telephony number masking**, which is the actual anti-leakage
  control. Phone numbers are masked in the UI, which is display hygiene.
- **No self-registration, no password reset, no invitations.** Accounts are
  created by `db:seed-users` or by hand. That is deliberate for four accounts
  and the obvious next thing to build for forty.
- **No per-field permissions inside a role.** §4.4 eventually wants finer
  control than "admins see everything".

## Run it

```bash
pnpm install
pnpm db:migrate          # needs DATABASE_URL
pnpm db:seed             # realistic Jaipur data — never against production
pnpm db:seed-users       # the four role accounts; prints passwords once
CONFIRM_RESET=yes pnpm db:reset   # wipes every table but the audit log
pnpm dev
```

Everything above works with no external credentials at all. To switch an
integration on, set its variables from `apps/web/.env.example`; `/integrations`
shows which are set, what each one enables, and what happens while it is off.

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
