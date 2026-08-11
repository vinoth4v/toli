# toli

India's charter marketplace for vans, tempo travellers and buses. Book a whole
vehicle for a whole group — transparent quotes, verified operators, live
tracking. Launching in **Madurai and south Tamil Nadu**; selling to all of India.

**Live:** https://toli-flame.vercel.app

> Scaffolded from [werft-template](https://github.com/vinoth4v/werft-template).

---

## Read this first if you are an agent or a new developer

This section is the orientation. The rest of the README is detail.

**The business plan is the specification.** `docs/00-index.md` and its five
parts are a real charter-marketplace plan, and the code cites it constantly —
`§7.1`, `§8.3`, `§4.2`. When a comment says "§9 says money is integer paise",
that is not decoration: the plan is the authority, and disagreeing with it is a
decision to raise rather than a detail to quietly fix.

**Three documents, three jobs, and you must update them.**

| File | Answers | When you touch it |
|---|---|---|
| `README.md` | What is this, what works, how do I run it | When the app can do something new |
| `docs/ARCHITECTURE.md` | How it is built *now*, decisions in force, known gaps | When the design changes — rewrite, do not append |
| `docs/SESSIONS.md` | What happened and why, what was rejected | Every session — append only, never edit |

A PR that changes behaviour and updates none of them is incomplete, and the
`docs` CI check says so out loud.

**`AGENTS.md` is the rulebook.** Read it before writing anything. The rules that
bite most often: never end on a red `pnpm build`; never call a model provider
directly; never write a raw colour or spacing value into CSS; never edit an
applied migration; never add a role or a sign-in method quietly.

**Where the logic actually lives.** The layering is strict, and it is the
fastest way to find anything:

```
src/domain/        pure functions, no I/O, heavily tested — pricing, GST,
                   settlement, compliance, segments, bills, roles, geo
src/data/          every database query; scoped.ts enforces "this is mine" by
                   putting ownership in the WHERE clause
src/integrations/  the outside world — Razorpay, maps, WhatsApp, VAHAN, S3
src/app/           routes only; they compose the layers and hold no arithmetic
```

If you are about to write a calculation inside a page, it belongs in
`src/domain` with a test. That is where the 198 unit tests live, and why they
run in two seconds without a database.

**To understand the product, read in this order:** `src/domain/quote.ts` (why
quotes are comparable), `src/data/scoped.ts` (how roles are kept apart), then
`src/app/page.tsx` (what the business claims publicly).

---

## What it does

### Four people, four applications

§3 needs genuinely different users, and is explicit that a driver must not be
an operator — a driver who can see the take rate can take the customer
off-platform next time.

| Role | Lands on | What it is |
|---|---|---|
| `admin` | `/console` | Ops: verification queue, matching desk, disputes, settlements, integrations |
| `customer` | `/portal` | Book now, get a quote, compare, pay, track, read the bill |
| `operator` | `/partner` | Quote inbox, standing rates, fleet, photos, earnings |
| `driver` | `/drive` | Today's trip in three big buttons — **and no money on any screen** |

Authorisation is one tested module (`src/domain/roles.ts`) enforced at the edge,
so a role never reaches another surface even for the instant before a layout
could redirect. It is an allow-list: a route added tomorrow is closed to
everyone until somebody says otherwise.

### Two ways to book

- **Book now** — vehicles actually free on the date, road-legal *on that date*,
  priced from the operator's standing rate card, driver named, booked in one
  tap. Nothing unbookable is ever shown, and availability is re-checked at the
  moment of booking.
- **Get a quote** — the RFQ lane. Describe the trip once; operators answer in
  one schema. Kept because it is the habit for long trips.

Both produce identical rows, so settlement, invoicing and compliance never
learn there are two lanes.

### The product's actual argument

Group charter is miserable because quotes are not comparable. Toli forces every
quote into §7.1's schema and refuses one that leaves **minimum km per day**
blank — the charge that turns ₹28,000 into ₹41,000. Every quote shows an
estimated total *and* an itemised worst case. Every bill shows what was added
after the quote, with tolls named in both directions.

### Segments, the car-rental ladder

Economy is non-AC, Premium is air conditioned, Luxury adds push-back seats.
**Derived from what a vehicle has, never declared** — "luxury non-AC" cannot be
expressed. A better vehicle may serve a cheaper booking; the reverse is
mis-selling.

### Trust machinery

- Registration, fitness, insurance, PUC and AIS-140 tracked to expiry, with the
  30/15/7-day ladder and hard suspension.
- Interstate needs a valid AITP on a vehicle inside the twelve-year age limit —
  enforced at assignment and at instant booking, not merely displayed.
- Operators add and retire their own vehicles, upload photos and file
  documents; **they cannot verify their own paperwork**, which is what the
  badge is worth.
- A public tracking link needing no app or login, showing a map, no prices and
  no phone numbers.
- GST invoices with the CGST/SGST or IGST split decided by place of supply, and
  settlements itemising commission, TCS, TDS, expenses and driver-collected cash.

### Six languages

English, Tamil, Hindi, Telugu, Malayalam, Kannada — typed dictionaries, so
adding an English string and forgetting Tamil **fails the build**. Hindi is in
the list but not at its head: this launches in Madurai. Customers can request a
driver who speaks a given language, and matching drivers are chosen first.

### Reaching a human

Indian customers phone before they pay. Toli's own number, WhatsApp and email
are published on the front page, the tracking link and every trip. The
operator's contact appears **once a booking exists** — §10's masking is about
*when*, not whether.

---

## Run it

```bash
pnpm install
pnpm db:migrate                    # needs DATABASE_URL
pnpm db:seed                       # realistic Madurai data
pnpm db:seed-users                 # four role accounts; prints passwords once
pnpm dev
```

```bash
pnpm build         # must exit 0 — the gate that matters
pnpm test          # 198 unit tests, no database needed
pnpm test:e2e      # Playwright smoke; needs pnpm build first
pnpm typecheck
pnpm lint / pnpm format
pnpm db:generate   # schema diff → migration, no database needed
CONFIRM_RESET=yes pnpm db:reset    # wipes everything but the audit log
```

Environment lives in `apps/web/.env.local`; `apps/web/.env.example` lists
everything. **The app runs fully with only `DATABASE_URL`, `AUTH_SECRET` and the
break-glass operator set** — every integration below is optional and degrades to
a manual path that names the missing variable.

| Integration | Variables | Without it |
|---|---|---|
| Razorpay | `RAZORPAY_*` | Payments recorded by hand |
| Google / Mappls geocoding | `GOOGLE_MAPS_API_KEY`, `MAPPLS_REST_KEY` | Stops stay text |
| OSRM routing | `OSRM_BASE_URL` | Distance typed in |
| WhatsApp | `WHATSAPP_*` | Messages queue in the outbox |
| VAHAN / Sarathi / GSTN | `VEHICLE_VERIFY_*` | Ops reads the portal and records it |
| S3 photo upload | `S3_BUCKET`, `AWS_*` | Operators link a photo hosted elsewhere |

`/console/integrations` shows the live inventory. Position ingest and embedded
maps need no credentials at all.

---

## Deployment

Merging to `main` deploys. Migrations run during that build, before it starts —
a failed migration fails the build and the previous deployment keeps serving.

Gates on every PR: `gitleaks`, `typecheck`, `build`, `docs`,
`neon-preview-branch` and `preview-smoke`. Each PR gets its own Neon database
branch, deleted when it closes.

## Change it

Comment `@claude` on an issue or PR, or say what you want on the app's
[marketplace](https://werft-marketplace.vercel.app) page. Claude works on a
branch and opens a pull request; a human merges. Nothing reaches production on
its own.

---

## What is deliberately not here

Named so nothing is mistaken for an oversight. `docs/ARCHITECTURE.md` carries
the full list with reasoning.

- **No customer, operator or driver mobile apps.** The plan's five surfaces
  include four mobile ones; these are the web equivalents, which is what makes
  the first few hundred bookings possible without them.
- **No payment gateway switched on.** Razorpay is written; nobody has opened a
  merchant account. Razorpay Route / Easy Split — §8.2's escrow posture — is
  not used at all yet.
- **No live government verification.** VAHAN, Sarathi and GSTN access is resold
  by authorised aggregators; ops records what the portal said, into the same
  table the automated check will write to.
- **The `hi`, `te`, `ml` and `kn` translations have had no native-speaker
  review.** Careful but unverified. A mistranslated SOS hint is worse than
  English.
- **No self-registration, password reset or invitations.** Accounts are created
  by script. Correct for four; the first thing to build for forty.
- **No session revocation.** The role lives in the JWT, so disabling an account
  stops the next sign-in, not the current session.
- **No SMS fallback, no cloud-telephony number masking, no 90-day GPS
  retention.**
