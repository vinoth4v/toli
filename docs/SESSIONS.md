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

## The charter desk

**Asked:** build the app according to the TOLI build plan (issue #1) — an
aggregator marketplace for chartered vans, tempo travellers and buses in India.

**Worked from a partial plan, deliberately.** The issue filed the plan's
*index* — the five part files (`01-strategy.md` … `05-execution.md`) are
relative links with no target in this repo, so the bodies of §0–§14 were never
readable. What was available: the section titles, the reading-order notes
(§8.3 GST classification and §8.4 aggregator licensing both flagged as needing
professional advice before code), and the app's own one-line description. The
build was scoped from those and from what the section titles imply. Everywhere
a §-reference appears in the code or docs, it points at what that section is
*about*, not at text anyone here has read. If the parts are attached later,
this is the entry to reconcile against — particularly §4 (feature scope by
surface), §7 (the pricing engine), and §9 (core entities), where the plan very
likely has specifics this session had to invent.

**Changed:** the whole app, at `/`. Six new tables
(`transport_operator`, `vehicle`, `enquiry`, `quote`, `booking`, `payment`) in
migration `0001_toli_marketplace`; a pure pricing/settlement domain layer with
unit tests; and seven routes covering enquiry → quote → booking → money. The
template's placeholder home page is gone. README, ARCHITECTURE and this entry
rewritten.

**Decided, and why:**

- **The app is the internal charter desk, not a public marketplace.** The
  template's gate is one operator and AGENTS.md forbids quietly adding a
  second. A customer-facing surface therefore cannot exist yet without a
  decision that is not this session's to make. Building the desk first is also
  the honest order: the supply side and the pricing have to work before anyone
  is invited to shop.
- **Money is integer paise and the quote stores its whole breakdown.** Both are
  about the same failure: a number a customer was quoted that nobody can
  reproduce later. Rounding happens in exactly one function; the fare is never
  recomputed after it is given.
- **Commission on the fare excluding GST**, not on the total. Taking a cut of
  tax collected on the operator's behalf would be charging them for their own
  tax. A test asserts commission is unchanged between the 5% and 12% regimes,
  because that is precisely how the mistake would come back.
- **The daily kilometre floor is waived for one-way drops.** A vehicle released
  at the destination has its empty return priced into the per-km rate already.
- **IST is stated, never assumed.** `datetime-local` carries no offset and
  Vercel runs UTC; parsing and formatting both name `Asia/Kolkata`.
- **Verification gates quoting at the query level.** The quote builder can only
  see vehicles of verified operators, so an unquotable option is never offered
  rather than being offered and then refused.
- **Accept order over transactions.** The neon-http driver has no interactive
  transactions. The booking is written first, protected by a unique index on
  `quote_id`, so a double-clicked accept is refused by the database and a
  half-failed accept still leaves the customer confirmed.
- **Route group `(app)` for the signed-in chrome**, so the root layout reads
  neither session nor environment and `next build` keeps working with no
  secrets — the 404 page is prerendered against that layout.

**Rejected:**

- **A `db.batch()` transaction for accepting a quote.** It would have been the
  correct shape, but this session could not run a typecheck (see below), and
  an unverifiable API guess in the one path that creates bookings was a worse
  risk than a documented write order.
- **Postgres enums for statuses.** The vocabularies are still moving; adding a
  value should not need a migration that locks a table.
- **Storing "amount paid" on the booking.** Smaller, and loses the only thing a
  payment dispute needs: when each rupee arrived, by which method, against
  which reference. Balances are derived from the ledger instead.
- **A live price preview in the quote builder.** It would need client
  JavaScript for a number the server can simply render — so every quotable
  vehicle is priced server-side and shown in the dropdown instead.
- **Adding design tokens for layout widths.** The rule targets colour, spacing
  and type; the template already writes a raw `max-width` on `main`, and
  inventing a token nobody would reuse is worse than following it.

**A gap in this session's verification, stated plainly.** The runner had `node`
but no usable `pnpm`, `npm`, `npx` or `corepack`, and direct script execution
was refused, so **no dependency install, typecheck, lint, unit test, build or
e2e run happened locally.** AGENTS.md says never to end on a red build and to
report the exit code; there is no exit code to report, which is a weaker
position and should be read as such. Two consequences worth knowing:

1. `pr-checks.yml` is the gate that actually verified this — `typecheck`,
   `build` and the preview smoke test on a real Neon branch. Nothing here
   should be merged on the strength of the code reading well.
2. `drizzle-kit generate` could not be run, so `0001_toli_marketplace.sql`,
   its snapshot and the journal entry were **written by hand** to match the
   generator's output exactly (constraint naming, statement order, snapshot
   shape). This is the one place to look first if `pnpm db:generate` in a later
   session proposes a migration that recreates tables that already exist.

**Open:** routing and distance (§6) is the highest-value next change — the
hand-typed `estimated_km` is the largest pricing error left. Quotes never
expire on their own. No gateway, invoices or GST filing, all of which need
§8.3/§8.4 advice first. Rate cards are indicative defaults and want real
numbers before anyone quotes a stranger. And the plan's five parts want
attaching and reconciling against what was built.
