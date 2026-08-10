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

## Lane A — the RFQ desk (issue #3)

**Asked:** Part 1 of the Toli build plan — name, strategy and audience — with
the instruction to build the app at `/`. The plan's own most important line is
"do not build Uber; build a marketplace with an RFQ engine", and it orders the
work: Lane A (assisted RFQ) now, Lane B (instant book) at month 6, Lane C
(contracts) at month 10. It also says supply comes first: forty verified
vehicles in one city before a demand-side app is worth having.

**Changed:** the whole app. Five new tables in migration
`0001_toli_marketplace` — `operator`, `vehicle`, `charter_request`, `quote`,
`booking`. A pricing core in `src/lib/pricing.ts` (Toli Fair Price), matching
in `src/lib/matching.ts`, money handling in `src/lib/money.ts`, and dates and
form-reading beside them, with unit tests for all five. Seven server actions.
Six routes: the desk at `/`, requirements, one requirement, operators, one
operator, bookings. The template's placeholder home page is gone, the
stylesheet grew a component layer built only from tokens and `color-mix` of
tokens, the favicon became the group mark, and the smoke test now asserts the
absence of the desk rather than the absence of the placeholder.

**Decided, and why:**

- **Build the desk, not the marketplace's public faces.** The gate holds one
  identity. Customer and operator apps would each need a real user store, which
  AGENTS.md says to raise rather than implement. Assisted RFQ is what a single
  identity can honestly support — and it matches the plan, where the value at
  this stage is the *structure* of the quote, not self-serve onboarding.
- **Landed cost is the product.** The seven components were taken straight from
  the plan's cost table (base, per-km, bata, night halt, toll, parking,
  interstate permit) because that list is the actual reason two spoken quotes
  cannot be compared. Pricing every quote against one trip shape is the whole
  differentiator, and it is where the tests are.
- **One kilometre estimate per requirement, owned by the desk.** If each
  operator supplied its own, ranking would be theatre.
- **Integer paise, rupees only at the edges.** A commission percentage on a
  float is how ₹1 disappears and nobody can say where.
- **Freeze booking totals at award.** A booking is what was agreed. Recomputing
  on read would let a future pricing change silently restate a trip somebody
  paid an advance on.
- **Write the booking row first when awarding.** `neon-http` has no
  multi-statement transaction. The unique index on `request_id` is therefore
  the thing that prevents a double award; the three status updates that follow
  are visible and correctable if one fails.
- **Keep partial matches, labelled.** Two of the three coaches is a phone call
  worth making. Dropping them would have made the list tidier and the
  marketplace worse.
- **Surface the supply rule in the app.** The desk shows verified vehicles
  against forty and says what being under it means. A launch rule that lives
  only in a document is a launch rule that gets ignored.

**Rejected:**

- **Instant book / published Toli rates (Lane B).** Tempting, and it would have
  looked more like the "Uber-like" framing in the original ask — but pricing
  confidently needs the dataset Lane A collects, and guessing rates on a
  wedding fleet is how an aggregator loses money it cannot see losing.
- **Per-seat selling.** RedBus owns intercity ticketing. The plan puts
  empty-leg selling in Phase 4 and it stays there.
- **Postgres enums for vehicle class and segment.** They lock the table for a
  change that should be a deploy. Text plus type guards instead.
- **A "load sample data" button.** It demos well and it writes junk into a
  production database that has no other way to be cleaned. An honest empty
  state pointing at "sign an operator" won.
- **Storing rupees as `numeric`.** Correct, and it would have meant a string
  round-trip through the driver on every read for a domain where nothing is
  ever priced below one rupee.
- **A scored matching algorithm.** Unexplainable ranking in a marketplace with
  forty suppliers is a way to lose their trust for no gain.

**Open:**

- **The build was not verified in this session, and that is a real gap.**
  `pnpm` is not installed in the `claude.yml` runner — there is no
  `pnpm/action-setup` step, though `pr-checks.yml` has one — so `pnpm build`,
  `pnpm typecheck`, `pnpm test` and `pnpm db:generate` could not be run here,
  and the GitHub App may not edit workflow files to fix it. The PR's own gates
  are therefore the first real verification. Adding a pnpm setup step to
  `claude.yml` would remove this hole for every future session.
- **Migration `0001` is hand-written** — SQL, journal entry and snapshot —
  because `db:generate` could not run. It was written to match drizzle-kit's
  output exactly. Before the next schema change, run `pnpm db:generate` and
  confirm it produces no spurious diff.
- **`pnpm test` is not a PR gate.** `pr-checks.yml` runs gitleaks, typecheck,
  build, the Neon preview branch and the preview smoke test — the unit suite is
  not among them, so the pricing tests protect only a human who runs them.
- No fan-out (SMS/WhatsApp), no payments, no GST invoice, no distance service,
  no pagination. All listed under Known gaps in ARCHITECTURE.md.
- `werft.json`'s description promised live tracking, which does not exist; it
  was rewritten this session to describe the RFQ engine that does.
