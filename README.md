# toli

**Book a whole van or bus for your whole group, in one place.**

Toli is the charter desk behind an aggregator marketplace for chartered vans,
tempo travellers and buses in India. A group wants a vehicle; several operators
could supply one; somebody has to price it honestly, hold the vehicle, and make
sure the operator is paid what they were promised. This app is where that
happens.

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).
> The hard rules live in `AGENTS.md`, the design in `docs/ARCHITECTURE.md`,
> and why each change was made in `docs/SESSIONS.md`.

## What it does

Everything below works today, at `/`, behind the single-operator sign-in.

- **Take an enquiry.** Who is travelling, from where to where, when, how far,
  how many, what class of vehicle. Times are entered and shown in IST.
- **Onboard operators and their vehicles.** A transport company starts
  unverified and *cannot be quoted* until someone has checked their papers —
  verification is the thing the marketplace actually sells. Each vehicle
  carries its registration, class, seats, permit type and expiry, and
  optionally the operator's own negotiated per-km rate.
- **Price the trip.** The quote builder shows what *every* available vehicle
  would cost on this trip before you pick one, priced by the same engine that
  will store the quote. The fare is per-km × chargeable distance, plus the
  driver's daily allowance, plus night halts, plus tolls and parking at cost,
  plus GST at either 5% (no input tax credit) or 12% (with it).
- **Send it, and win or lose it.** A quote goes draft → sent → accepted or
  declined. Accepting one creates the booking, declines the rest, and marks
  the enquiry won — in an order chosen so a half-failed accept still leaves
  the customer with a confirmed booking.
- **Run the trip.** Assign the driver, their phone and the actual registration
  shortly before departure; move the booking confirmed → on trip → completed,
  or cancel it with a reason. A booking never moves backwards.
- **Settle the money.** Every rupee is a ledger entry — advance, balance,
  payout, refund — with method and reference. The app derives what the
  customer still owes and what the operator is still owed; nothing is a stored
  balance that can drift.
- **See what needs doing.** The home page leads with trips that have already
  departed and are still open, then the next departures, then the totals:
  booked value, commission earned, open enquiries, quotes awaiting a reply.

Every notable action is written to an append-only audit log, which keeps
working even when that write fails.

## What works, and what does not

**Works**

- The whole enquiry → quote → booking → settlement path, end to end.
- Fare arithmetic in integer paise, unit tested against the cases that
  actually cost money: daily kilometre floors, one-way drops, night halts,
  both GST regimes, and commission taken on the fare rather than on the tax.
- Operator verification gating, permit expiry warnings, duplicate-registration
  refusal, and booking status transitions enforced server-side.
- IST handling that does not depend on the server's time zone.

**Does not, deliberately**

- **No customer-facing or operator-facing surface.** This is the internal desk
  only. The template's gate is one operator, and adding a second real user
  needs a real user store — a decision to raise, not to implement quietly.
- **No maps or routing.** Distance is typed in by whoever takes the enquiry.
  See §6 in the plan and *Known gaps* in the architecture doc for why, and for
  what changes when a routing provider is chosen.
- **No payment gateway.** Payments are *recorded*, not *taken*. Nothing here
  moves money; it writes down money that moved elsewhere.
- **No invoices or e-way documents**, and no automated GST filing. The rate is
  stored per quote so an invoice can be generated later, but §8.3 and §8.4 need
  professional advice before any of it becomes a legal document.
- **No notifications.** Quotes are marked sent by hand, because they are sent
  by hand — over WhatsApp, usually.
- **No live tracking**, despite the marketplace listing mentioning it.

## Run it

```bash
pnpm install
pnpm dev
```

Environment lives in `apps/web/.env.local`; `apps/web/.env.example` lists what
is needed. `pnpm hash-password` sets the operator password — an app with none
cannot be signed into.

To create the tables, point `DATABASE_URL` at a Neon database and run
`pnpm db:migrate`. Migrations are append-only and checked in.

```bash
pnpm build       # the gate that matters — must exit 0
pnpm test        # unit tests: pricing, money, dates, references, settlement
pnpm test:e2e    # Playwright, needs a build first
```

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
