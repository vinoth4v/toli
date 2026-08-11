import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { homeFor } from "@/domain/roles"
import { VEHICLE_CLASS_INFO } from "@/domain/vehicle"

/**
 * Toli's front door.
 *
 * The argument this page has to make is the one §4.1 identifies as the whole
 * reason the product exists: group charter is miserable today because quotes
 * are not comparable, and a ₹28,000 quote becomes a ₹41,000 bill through two
 * charges nobody showed you. So the centrepiece is not a photograph of a bus —
 * it is two quote cards side by side, with the hidden charges visible.
 *
 * Signed in, this redirects to whichever application the person belongs to —
 * ops to the console, an organiser to their trips, an operator to their quote
 * inbox, a driver to today. Nobody should have to click past a welcome page to
 * reach their own app, and a marketing page is exactly the sort of thing that
 * quietly becomes that.
 */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Toli — book a whole van or bus for your whole group",
  description:
    "India's charter marketplace for tempo travellers, mini buses and coaches. Every quote in the same shape, every charge visible before you book, every vehicle's papers checked.",
}

/** The two quotes from the plan's own worked example, in paise. */
const COMPARISON = [
  {
    operator: "Operator A",
    headline: 1_596_000,
    worst: 1_902_000,
    perKm: "₹23/km",
    minKm: "300 km/day",
    chips: [
      { label: "Toll included", tone: "included" },
      { label: "Interstate tax included", tone: "included" },
      { label: "Parking excluded", tone: "excluded" },
    ],
    verdict: "Costs more per kilometre. Ends up cheaper.",
  },
  {
    operator: "Operator B",
    headline: 1_690_500,
    worst: 2_514_500,
    perKm: "₹21/km",
    minKm: "350 km/day",
    chips: [
      { label: "Toll included", tone: "included" },
      { label: "Interstate tax excluded", tone: "excluded" },
      { label: "Parking excluded", tone: "excluded" },
    ],
    verdict: "The cheaper rate, and ₹6,125 more at worst.",
  },
] as const

const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100)

export default async function HomePage() {
  const session = await auth()
  if (session?.user) redirect(homeFor(session.user.role))

  return (
    <div className="landing">
      <header className="landing-top">
        <span className="wordmark">
          toli
          <small>chartered vans, tempo travellers and buses</small>
        </span>
        <nav>
          <a href="#how">How it works</a>
          <a href="#fleet">Fleet</a>
          <a href="#operators">For operators</a>
          <Link href="/login" className="signin">
            Ops sign in
          </Link>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">Jaipur · Delhi NCR · Agra · Udaipur</p>
        <h1>
          Book a whole van or bus
          <br />
          for your whole group.
        </h1>
        <p className="lede">
          One requirement, sent to operators who actually have the vehicle. Every quote comes back
          in the same shape, so you compare numbers instead of deciphering five people's WhatsApp
          messages.
        </p>
        <div className="hero-actions">
          <Link href="/login" className="button-link">
            Start a requirement
          </Link>
          <a href="#compare" className="button-link quiet">
            See why quotes lie
          </a>
        </div>
        <dl className="hero-stats">
          <div>
            <dt>Quote response</dt>
            <dd>under 30 min</dd>
          </div>
          <div>
            <dt>Papers checked</dt>
            <dd>every vehicle</dd>
          </div>
          <div>
            <dt>Live tracking</dt>
            <dd>no app needed</dd>
          </div>
        </dl>
      </section>

      <section id="compare" className="section">
        <h2 className="section-title">The ₹28,000 quote that becomes a ₹41,000 bill</h2>
        <p className="section-lede">
          Two charges do almost all of the damage: the <strong>minimum kilometres per day</strong>{" "}
          you pay for whether you travel them or not, and the <strong>interstate permit tax</strong>{" "}
          that appears at a border at 2 AM. Toli makes both of them fields every operator must fill
          in — so the cheaper-looking quote stops winning by hiding things.
        </p>

        <div className="compare">
          {COMPARISON.map((quote) => (
            <article key={quote.operator} className="compare-card">
              <header>
                <h3>{quote.operator}</h3>
                <p className="rate">
                  {quote.perKm} · min {quote.minKm}
                </p>
              </header>
              <p className="price">{rupees(quote.headline)}</p>
              <p className="worst">
                worst case <strong>{rupees(quote.worst)}</strong>
              </p>
              <ul className="chip-list">
                {quote.chips.map((chip) => (
                  <li key={chip.label} className={`chip ${chip.tone}`}>
                    {chip.label}
                  </li>
                ))}
              </ul>
              <p className="verdict">{quote.verdict}</p>
            </article>
          ))}
        </div>

        <p className="footnote">
          Same trip, Jaipur to Agra and back over two days. Operator B quotes ₹2 less per kilometre
          and is the more expensive booking, because 350 km a day is 140 km further than the trip
          actually runs. That is the whole problem, in one table.
        </p>
      </section>

      <section id="how" className="section alt">
        <h2 className="section-title">How it works</h2>
        <ol className="steps">
          <li>
            <span className="step-number">1</span>
            <h3>Tell us the trip</h3>
            <p>
              Where from, where to, how many people, which dates, and anything that matters — a
              wedding needs a decorated vehicle, a pilgrimage needs unhurried stops.
            </p>
          </li>
          <li>
            <span className="step-number">2</span>
            <h3>Operators quote in one shape</h3>
            <p>
              Per-km rate, minimum km per day, driver bata, night halt, and whether toll, parking
              and interstate tax are in or out. No free text where a number belongs.
            </p>
          </li>
          <li>
            <span className="step-number">3</span>
            <h3>Compare, and see the worst case</h3>
            <p>
              Every quote shows what it should cost and what it could cost, itemised. A Fair Price
              band shows what comparable trips usually go for.
            </p>
          </li>
          <li>
            <span className="step-number">4</span>
            <h3>Book, track, and get a GST invoice</h3>
            <p>
              Pay the advance by UPI. Share a tracking link with sixty guests — no app, no login.
              Download an invoice your accounts team will accept.
            </p>
          </li>
        </ol>
      </section>

      <section id="fleet" className="section">
        <h2 className="section-title">Every size this market actually runs</h2>
        <p className="section-lede">
          Seat counts are not decoration. A group of 14 does not fit a 13-seater, and a 26-seater
          for the same group is a quote 40% too expensive.
        </p>
        <div className="fleet-grid">
          {Object.values(VEHICLE_CLASS_INFO).map((info) => (
            <article key={info.key} className="fleet-card">
              <h3>{info.label}</h3>
              <p className="seats">{info.seatOptions.join(" · ")}</p>
              <p className="use">{info.typicalUse}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section alt">
        <h2 className="section-title">What we check before a vehicle carries you</h2>
        <div className="trust-grid">
          <article>
            <h3>Papers, not photographs</h3>
            <p>
              Registration, fitness, insurance, PUC and the AIS-140 tracking device — each with its
              expiry tracked. A vehicle whose insurance lapsed cannot be assigned to your trip, in
              wedding season or any other.
            </p>
          </article>
          <article>
            <h3>Interstate means a real permit</h3>
            <p>
              Crossing a state line needs an All India Tourist Permit on a vehicle inside the
              twelve-year age limit. Without one, the booking is refused here — not at a check post
              with your family inside.
            </p>
          </article>
          <article>
            <h3>Drivers who were actually verified</h3>
            <p>
              Licence, police verification, medical check and induction training, recorded per
              driver and re-checked as they expire.
            </p>
          </article>
          <article>
            <h3>A tracking link for everyone</h3>
            <p>
              One link, any browser, no install. Sixty guests can watch the bus approach without any
              of them seeing what you paid.
            </p>
          </article>
        </div>
      </section>

      <section id="operators" className="section operators">
        <div>
          <h2 className="section-title">For fleet owners</h2>
          <p className="section-lede">
            Travel agents take 15–25%. Toli takes 8–12%, says so on every settlement statement, and
            pays out on a schedule you can plan around — with the commission, TCS and TDS shown as
            separate lines rather than a number you have to reverse-engineer.
          </p>
          <ul className="operator-points">
            <li>Quote from your phone; standing rate cards quote for you</li>
            <li>Settlement statements with every deduction itemised</li>
            <li>Your documents verified once, tracked to expiry, renewed on a reminder</li>
            <li>Sub-contracting modelled properly, because it happens</li>
          </ul>
        </div>
        <aside className="settlement-card">
          <h3>A settlement, in full</h3>
          <table>
            <tbody>
              <tr>
                <td>Trip value</td>
                <td>₹15,960</td>
              </tr>
              <tr>
                <td>Toli commission (9%)</td>
                <td>−₹1,436</td>
              </tr>
              <tr>
                <td>TCS</td>
                <td>−₹160</td>
              </tr>
              <tr>
                <td>TDS</td>
                <td>−₹160</td>
              </tr>
              <tr>
                <td>Tolls you paid</td>
                <td>+₹300</td>
              </tr>
              <tr>
                <td>Cash the driver took</td>
                <td>−₹11,970</td>
              </tr>
              <tr className="total">
                <td>Transferred to you</td>
                <td>₹2,534</td>
              </tr>
            </tbody>
          </table>
          <p className="footnote">No line you have to ask about afterwards.</p>
        </aside>
      </section>

      <footer className="landing-foot">
        <div>
          <span className="wordmark">toli</span>
          <p className="muted small">
            Chartered vans, tempo travellers and buses across Rajasthan and the Delhi corridor.
          </p>
        </div>
        <p className="muted small">
          Operating a fleet? <Link href="/login">Sign in to the ops console</Link>.
        </p>
      </footer>
    </div>
  )
}
