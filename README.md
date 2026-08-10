# toli

**टोली — a band of people moving together.** An aggregator marketplace for
chartered vans, tempo travellers and buses in India: the whole vehicle for a
group, never a seat on somebody else's bus.

*Poori toli, ek gaadi.* — the whole group, one vehicle.

This repository is **Toli Admin**, the desk the marketplace is run from. Today
it is the entire product: one person signs the operators, takes the
requirements, records the quotes and awards the trips.

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).
> The hard rules live in `AGENTS.md`, the design in `docs/ARCHITECTURE.md`,
> and why each change was made in `docs/SESSIONS.md`.

## What it does

Charter is not a cab ride. Nobody books a fifteen-vehicle wedding fleet three
minutes ahead, and no algorithm sets the price — an operator quotes, and the
customer compares. So this is not Uber. It is a **request-for-quote engine**:

1. **Sign the supply.** Register fleet operators — small businesses with four
   to thirty vehicles, an owner and a dispatcher — and their vehicles, with
   class, seats, registration, and whether each one is on the road. Mark an
   operator verified once you have actually seen the permit, the fitness
   certificate and a vehicle. Set what Toli takes, per operator.
2. **Take a requirement.** Who is travelling, for what occasion, from where,
   over which dates, how many people, which class of vehicle and how many of
   them — plus the desk's own estimate of running kilometres, which is the
   number that makes competing quotes comparable at all.
3. **See who can serve it.** Matching is same city, a vehicle class at least as
   big as the one asked for, and enough seats. Verified operators come first;
   an operator who can field part of the fleet is kept and labelled rather than
   hidden, because two of the three coaches is still a phone call worth making.
4. **Record the quotes.** They arrive by phone and WhatsApp, so the desk types
   them in — always as the same seven components: base fare, kilometres
   included, the rate beyond that, driver bata per day, night halt per night,
   and the three that get left out of a spoken price: tolls, parking, and the
   interstate permit.
5. **Compare on landed cost — Toli Fair Price.** Every quote is priced against
   *this* trip's days, nights and kilometres, then ranked by what the group
   will actually pay. A ₹28,000 quote with 800 km included and ₹22/km after it
   is dearer than a ₹36,000 quote with everything in, and the desk sees that
   before the money moves rather than after. Each row opens into the full
   itemisation, the operator's payout, Toli's commission, and what a travel
   agent would have taken on the same trip.
6. **Award one.** The numbers freeze: all-in, the 25% advance, the commission.
   The other quotes are declined, the requirement closes, and the trip appears
   under Bookings to be marked done or cancelled.

Everything sits behind the single-operator sign-in, at `/`.

## What works, and what does not

**Works today**

- Operators and vehicles: sign, verify, set commission, take a vehicle off the
  road and put it back on.
- Charter requirements across five segments — wedding, corporate, pilgrimage,
  school, employee transport — multi-day, multi-stop, multi-vehicle.
- Matching by city, vehicle class and capacity, including partial fits.
- Structured quotes: all seven cost components, each extra either included in
  the fare or charged on top.
- Toli Fair Price: landed-cost ranking, delta against the best quote, per-head
  and per-day figures, and a full breakdown per quote.
- Award, with all-in, advance and commission frozen onto the booking.
- A desk showing open requirements, quotes awaiting a decision, verified fleet
  against the forty-vehicle launch target, booked value and commission earned.
- An append-only audit trail of every sign-in, requirement, quote and award.

**Deliberately not built**

- **No customer app and no operator app.** The gate holds exactly one identity
  — one email and one password hash, in the environment. Letting customers or
  operators sign in needs a real user store, which is a decision to raise, not
  something to implement quietly.
- **No fan-out.** The app says who to call; the desk still calls them. No SMS,
  no WhatsApp API, no email.
- **No payments.** The advance is a number to collect, not a payment link. No
  gateway, no settlement run, no GST invoice.
- **No Lane B (instant book) or Lane C (contracts).** Both are months out in
  the plan, and both depend on the price data Lane A exists to collect.
- **No live tracking, no ratings, no empty-leg selling, no per-seat sales.**
  The registry description used to promise live tracking; it has been rewritten
  to describe what is actually here.

Money is stored in paise as integers throughout. Rounding happens at the edges,
and it is tested rather than assumed.

## Run it

```bash
pnpm install
pnpm dev
```

Environment lives in `apps/web/.env.local`; `apps/web/.env.example` lists what
is needed. `pnpm hash-password` sets the operator password — an app with none
cannot be signed into. `pnpm db:migrate` applies migrations to `DATABASE_URL`.

The app starts empty, and it is meant to be filled supply-first: sign an
operator, add its vehicles, then post a requirement. A requirement posted into
an empty operator list matches nobody — that is the app telling you the truth
about your marketplace, not a bug.

```bash
pnpm build       # the gate that matters — must exit 0
pnpm test        # unit tests: pricing, money, matching, dates, forms
pnpm test:e2e    # Playwright smoke, after a build
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
