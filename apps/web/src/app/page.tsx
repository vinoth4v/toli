import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { HeroScene, NightScene, PambanScene } from "@/components/hero-scene"
import { ToliLogo } from "@/components/logo"
import { publicSettings } from "@/data/settings"
import { tollNotice } from "@/domain/bill"
import { mailtoLink, telLink, whatsappLink } from "@/domain/contact"
import { homeFor } from "@/domain/roles"
import { SEGMENT_INFO, SEGMENTS } from "@/domain/segment"
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

/**
 * The four ways in, in the order a stranger meets them: most people arriving
 * here are booking a bus, and almost nobody is Toli's own ops desk.
 */
const DOORS = [
  {
    role: "customer",
    label: "Booking a vehicle",
    title: "Your trips",
    does: "Ask for a vehicle, compare quotes honestly, pay, and watch the trip.",
  },
  {
    role: "operator",
    label: "Running a fleet",
    title: "Toli Partner",
    does: "Quote inbox, fleet paperwork, and what every trip actually pays you.",
  },
  {
    role: "driver",
    label: "Driving",
    title: "Toli Driver",
    does: "Today's trip, start and finish, tolls you paid, SOS.",
  },
  {
    role: "admin",
    label: "Toli staff",
    title: "Ops console",
    does: "Verification, matching, disputes, settlements.",
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

  // A marketplace with no visible number reads as one with nobody behind it,
  // and in this market people phone before they pay.
  const settings = await publicSettings()

  return (
    <div className="landing">
      <header className="landing-top">
        <ToliLogo />
        <nav>
          <a href="#how">How it works</a>
          <a href="#fleet">Fleet</a>
          <a href="#operators">For operators</a>
          <a href="#signin">Who signs in</a>
          <Link href="/login" className="signin">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Madurai · Kodaikanal · Rameswaram · Palani · Trichy</p>
          <h1>Book a whole van or bus for your whole group.</h1>
          <p className="lede">
            One requirement, sent to operators who actually have the vehicle. Every quote comes back
            in the same shape, so you compare numbers instead of deciphering five people's WhatsApp
            messages.
          </p>
          <div className="hero-actions">
            <Link href="/register?as=customer" className="button-link">
              Book a vehicle
            </Link>
            <a href="#compare" className="button-link quiet">
              See why quotes lie
            </a>
          </div>
        </div>

        {/* Not a photograph of a bus: the product itself, as a still. What an
            investor is buying is the software, so the hero shows the software. */}
        <aside className="hero-visual">
          <HeroScene />
          <div className="demo-card" aria-hidden="true">
            <header>
              <span className="demo-ref">TOLI-B-000002</span>
              <span className="demo-live">
                <i /> Live
              </span>
            </header>
            <ol className="demo-route">
              <li>
                <span className="demo-dot from" />
                Meenakshi Temple, Madurai
              </li>
              <li>
                <span className="demo-dot to" />
                Kodai Lake, Kodaikanal
              </li>
            </ol>
            <div className="demo-crew">
              <span className="demo-avatar">MS</span>
              <span>
                Murugan S. · <span className="numeric">TN 58 AL 4521</span>
                <small>17-seat tempo traveller · Premium</small>
              </span>
            </div>
            <footer>
              <span>
                <small>All-inclusive</small>
                <strong>₹15,960</strong>
              </span>
              <span className="demo-chip">Toll included</span>
            </footer>
          </div>
        </aside>
      </section>

      <section className="band-dark" aria-label="What Toli holds itself to">
        <div>
          <strong>&lt; 30 min</strong>
          <span>quote response, or the RFQ escalates to a human</span>
        </div>
        <div>
          <strong>100%</strong>
          <span>vehicles with papers checked before they carry anyone</span>
        </div>
        <div>
          <strong>₹0</strong>
          <span>hidden charges — the worst case is printed on every quote</span>
        </div>
        <div>
          <strong>24×7</strong>
          <span>a person on the phone, not a chatbot</span>
        </div>
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
          Same trip, Madurai to Kodaikanal and back over two days. Operator B quotes ₹2 less per
          kilometre and is the more expensive booking, because 350 km a day is far more than the
          trip actually runs. That is the whole problem, in one table.
        </p>
      </section>

      <section id="lanes" className="section">
        <h2 className="section-title">Two ways to book, because trips are not all the same</h2>
        <p className="section-lede">
          A vehicle for tomorrow morning is a different decision from a four-day temple circuit in
          December. So there are two lanes, and the same verified fleet behind both.
        </p>

        <div className="lane-grid">
          <article className="lane">
            <span className="lane-tag">Book now</span>
            <h3>See what is free and take it</h3>
            <p>
              Vehicles that are actually free on your date, priced at the operator's standing rate,
              with the driver named. One tap and it is yours — no waiting for anybody to reply.
            </p>
            <p className="muted small">Best for airport runs, day trips, and anything this week.</p>
            <Link href="/login?as=customer" className="button-link">
              Book now
            </Link>
          </article>

          <article className="lane">
            <span className="lane-tag">Get a quote</span>
            <h3>Let operators compete for a bigger trip</h3>
            <p>
              Describe the trip once and operators come back with prices in the same shape. Worth
              the wait when the trip is long, the group is large, or the dates are still moving.
            </p>
            <p className="muted small">
              Best for multi-day tours, weddings, pilgrimage circuits and corporate offsites.
            </p>
            <Link href="/login?as=customer" className="button-link quiet">
              Get a quote
            </Link>
          </article>
        </div>
      </section>

      <section id="segments" className="section alt">
        <h2 className="section-title">Pick the comfort, not the chassis</h2>
        <p className="section-lede">
          Three tiers, the way you would hire a car. You may be given a better vehicle than you paid
          for — never a worse one.
        </p>
        <div className="segment-grid">
          {SEGMENTS.map((segment) => {
            const info = SEGMENT_INFO[segment]
            return (
              <article key={segment} className="segment-tile">
                <h3>{info.label}</h3>
                <p className="segment-promise">{info.promise}</p>
                <ul>
                  {info.includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
        <p className="footnote">{tollNotice(false)}</p>
      </section>

      <section id="how" className="section">
        <h2 className="section-title">How it works</h2>
        <PambanScene />
        <ol className="steps">
          <li>
            <span className="step-number">1</span>
            <h3>Tell us the trip</h3>
            <p>
              Where from, where to, how many people, which dates, and anything that matters — a
              wedding needs a decorated vehicle, and a Palani pilgrimage needs unhurried stops.
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
          <p>
            <Link href="/register?as=operator" className="button-link">
              Apply as an operator
            </Link>
          </p>
          <NightScene />
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

      <section id="signin" className="section alt">
        <h2 className="section-title">Four people, four applications</h2>
        <p className="section-lede">
          A driver is not an operator and an operator is not the ops desk — so Toli is four
          applications behind one sign-in. Pick the one that describes you; your account decides
          where you actually land, so there is nothing to get wrong here.
        </p>

        <p className="section-lede">
          No account yet? <Link href="/register">Create one</Link> — groups register themselves,
          operators apply, and drivers get their sign-in from their operator.
        </p>

        <div className="door-grid">
          {DOORS.map((door) => (
            <Link key={door.role} href={`/login?as=${door.role}`} className="door">
              <span className="door-role">{door.label}</span>
              <strong>{door.title}</strong>
              <span className="door-does">{door.does}</span>
              <span className="door-go">Sign in →</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="landing-foot">
        <div>
          <ToliLogo />
          <p className="foot-line">
            Chartered vans, tempo travellers and buses. Starting in Madurai and south Tamil Nadu,
            for groups travelling anywhere in India.
          </p>
        </div>
        <div className="foot-contact">
          <p className="muted small">
            Rather talk to someone? Call <strong>{settings.supportPhone}</strong> — a person
            answers.
          </p>
          <p className="contact-actions">
            {whatsappLink(settings.supportWhatsapp) ? (
              <a
                className="button-link"
                href={whatsappLink(settings.supportWhatsapp) as string}
                rel="noreferrer noopener"
                target="_blank"
              >
                WhatsApp us
              </a>
            ) : null}
            {telLink(settings.supportPhone) ? (
              <a className="button-link quiet" href={telLink(settings.supportPhone) as string}>
                Call
              </a>
            ) : null}
            {mailtoLink(settings.supportEmail) ? (
              <a className="button-link quiet" href={mailtoLink(settings.supportEmail) as string}>
                {settings.supportEmail}
              </a>
            ) : null}
          </p>
          <p className="muted small">
            Already with Toli? <Link href="/login">Sign in</Link> — groups, operators, drivers and
            the Toli desk all start here.
          </p>
        </div>
      </footer>
    </div>
  )
}
