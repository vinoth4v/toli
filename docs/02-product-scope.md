# TOLI — Build Plan
### Part 2 — Product Scope

*An aggregator marketplace for chartered vans, tempo travellers and buses in India.*
*Version 1.0 · 10 August 2026 · Part 2 of 5*

[← Index](00-index.md) · [← Part 1 — Name & Strategy](01-strategy.md) · [Part 3 — Technology & Data →](03-technology.md)

---

## 3. System surfaces

You asked for three logins. You actually need **five surfaces** — the driver is a distinct user from the operator, and operators do their real work on a desktop, not a phone.

| # | Surface | User | Platform | Why |
|---|---|---|---|---|
| 1 | **Toli** (customer app) | Group organiser | Android + iOS | The consumer brand |
| 2 | **Toli Partner** (operator app) | Fleet owner / dispatcher | Android + iOS | Quote fast from anywhere; push notifications for new RFQs |
| 3 | **Toli Partner Console** | Operator's office staff | Web (React) | Bulk fleet upload, document management, invoices, settlement reconciliation, roster planning. Nobody manages 40 vehicles on a 6-inch screen |
| 4 | **Toli Driver** | Driver | Android only | Location broadcast, trip start/stop, OTP verification, expense capture, SOS |
| 5 | **Toli Admin** | Your ops, finance, support teams | Web (React) | Verification queue, dispute resolution, manual matching, pricing controls, payouts, fraud review |

**Why Driver is separate from Partner:** the operator does not go on the trip. If you merge them, you'll either give the driver access to commercial data (he'll learn your take rate and disintermediate you) or you'll cripple the operator's app with background location permissions. Separate binaries. This is how Porter, BlackBuck and every serious Indian fleet platform is built.

**Why Driver is Android-only:** ~99% of commercial drivers in this segment are on Android, usually a sub-₹12,000 device with 3GB RAM and an aggressive OEM battery killer (Xiaomi, Vivo, Oppo, Realme). Building iOS here is wasted effort; building it *natively in Kotlin* is not optional, for reasons in §5.

---

---

## 4. Feature scope by surface

### 4.1 Customer app (Toli)

**Onboarding**
- Phone + OTP only (no password). Use a DLT-registered SMS provider with WhatsApp OTP fallback — Indian SMS delivery is genuinely unreliable
- Optional profile: name, email, GSTIN (critical — corporates cannot expense a trip without a GST invoice)
- Language switcher: English, Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, Punjabi (start with English + Hindi, ship the i18n plumbing on day one)

**Requirement builder** — the most important screen in the product
- Trip type: One-way / Round trip / Multi-day tour / Local package (8hr–80km, 12hr–120km) / Airport transfer / Recurring
- Pickup + drop with map pin, plus intermediate stops (drag to reorder)
- Date, time, return date
- Passenger count → suggests vehicle configuration (see §4.6)
- Vehicle preferences: AC/non-AC, seat count, luggage carrier, pushback seats, sleeper, wheelchair-accessible (now a regulatory expectation under MVAG 2025)
- Extras: driver in uniform, decorated vehicle (wedding), music system, hostess, first-aid, live tracking link for guests
- Free-text note + photo/voice-note attachment (huge for Indian users — they'd rather record 20 seconds than fill a form)
- **Save as template** for repeat trips

**Quote comparison**
- Cards showing operator rating, vehicle photos (real ones, uploaded and verified — not stock images), year of manufacture, **all-inclusive price with the extras broken out**
- Standardised inclusion/exclusion chips: `Toll included` `Parking excluded` `Driver bata ₹500/day` `Interstate tax included` `Night halt ₹300`
- **This is your core UX innovation.** The reason group booking is miserable today is that quotes are not comparable. Force every quote into the same schema and you've already won.
- Chat with operator (in-app, phone number masked via a cloud-telephony number)
- One-tap counter-offer

**Booking & payment**
- Advance (20–30%) online, balance either online before departure or cash to driver
- Payment methods in priority order: **UPI intent/collect** (70%+ of transactions), cards, netbanking, wallets, and *Pay Later / NEFT with PO* for corporates
- Cancellation policy shown *before* payment, tiered by days-to-departure
- Auto-generated GST invoice as PDF, emailed and downloadable

**Live trip**
- Vehicle + driver details released T-12h (photo, name, phone, RC number, DL verified badge)
- Live map tracking
- **Shareable public tracking link** — no app install, works in any browser. For a wedding, 60 guests want to know where the bus is. This is your best organic acquisition channel; put a soft "Book on Toli" CTA on that page
- SOS button → your 24×7 ops desk + configured emergency contacts
- In-trip issues: "AC not working", "driver rash", "vehicle different from booked" → routed to ops with SLA

**Post-trip**
- Structured rating: vehicle cleanliness, driver behaviour, punctuality, matched-the-booking
- Photo evidence for disputes
- Invoice, GST download, rebook-in-one-tap

### 4.2 Operator app + console (Toli Partner)

**Onboarding & KYC**
- Business PAN, GSTIN, address proof, cancelled cheque / bank details, signed agreement (e-sign via Aadhaar eSign or DocuSign)
- Per-vehicle: RC, permit (state tourist / **AITP** for interstate), fitness certificate, insurance, PUC, VLTD/AIS-140 certificate, 6+ real photos (exterior, interior, seats, boot)
- Per-driver: DL, Aadhaar/police verification, photo, medical fitness declaration
- **Auto-verify against government sources**: VAHAN for RC, permit and fitness; Sarathi/Parivahan for DL; GSTIN API for tax registration. Manual review only for exceptions. This is your defensibility — most competitors accept a photo of a document and hope.
- Expiry tracking with 30/15/7-day reminders, and **hard auto-suspension** of a vehicle whose permit or insurance has lapsed. Non-negotiable.

**Lead flow**
- Push notification within seconds of a matching RFQ
- Structured quote form: base fare, per-km rate, min-km/day, driver bata, night halt, toll/parking inclusion toggle, interstate tax inclusion toggle, extras
- **Rate card mode** — operator sets standing rates by vehicle type and route band; system auto-generates quotes on their behalf and they simply confirm. Dramatically raises response rate, which is the metric that kills marketplaces
- Response-time leaderboard and visible impact on ranking

**Fleet operations**
- Calendar/gantt view of vehicle availability; block dates for maintenance
- Assign vehicle + driver to a confirmed booking
- Trip lifecycle: assigned → driver dispatched → started (odometer photo) → in transit → completed (odometer photo)
- Sub-contracting: mark a trip as passed to a partner operator, with liability trail. **This happens constantly in the real market** — pretending it doesn't will cause your worst incidents. Model it explicitly and require the sub-contracted vehicle to also be on-platform

**Money**
- Earnings dashboard: pending, in-escrow, settled
- Settlement statements with TDS and commission line items
- Instant-settlement option at a small fee (a real revenue line, and operators want it badly)
- Invoice download for their own accounting

### 4.3 Driver app (Toli Driver)

Deliberately minimal — three big buttons, works on a bad phone, works offline.

- OTP login, today's trip card
- Navigate (hands off to Google Maps/Mappls app rather than reinventing turn-by-turn)
- Start trip: OTP from passenger + odometer photo + vehicle-condition photo
- Background location broadcast (foreground service, ~10s ping while active, 60s while idle)
- Expense capture: toll, parking, fuel, state permit — photo of receipt, auto-added to trip settlement
- SOS
- Offline queue: all events buffer locally and sync when connectivity returns. Half your trips will pass through zones with no data
- Language: full Hindi/regional, icon-heavy, minimal text

### 4.4 Admin console

- **Verification queue** — document review with side-by-side government API result
- **Booking control tower** — every live trip on one map, with delay/deviation/SOS alerts
- **Manual matching desk** — for the first 12 months, a human will beat your algorithm on high-value RFQs. Build the tooling to let them
- **Dispute & refund** workflow with evidence timeline
- **Pricing controls** — commission by segment/city/operator tier, promo engine, surge caps
- **Finance** — payout runs, reconciliation, GST reports, TDS/TCS registers
- **Fraud** — off-platform leakage detection (see §10), duplicate accounts, GPS spoofing
- **CMS** — cities, vehicle types, cancellation policies, banners, push campaigns
- **RBAC + full audit log** — every admin action attributable. Regulators and your future auditors will ask

### 4.5 Notifications

WhatsApp Business API is your primary channel, not push. Indian users disable push and don't open apps between trips, but they read WhatsApp. Budget for it: booking confirmations, driver details, tracking links, payment reminders, invoices. SMS via DLT-registered templates as fallback. Push for in-session urgency only.

### 4.6 Vehicle taxonomy (get this right in the schema on day one)

| Class | Seats | Typical use |
|---|---|---|
| MPV / SUV | 6–7 | Small family group |
| Force Traveller / Tempo Traveller | 9, 12, 13, 17, 20, 26 | The workhorse of this market |
| Mini bus | 21, 25, 32 | Local functions, school |
| Coach — seater | 35, 40, 45, 49 | Corporate, pilgrimage |
| Coach — Volvo/Scania multi-axle | 41–49 | Premium long distance |
| Sleeper coach | 30–40 berths | Overnight |
| Double-decker / open-top | varies | Events, tourism |

Attributes: AC / non-AC, push-back, luggage carrier, LED/TV, mic system, washroom (rare), year of manufacture, BS emission norm, fuel type, wheelchair accessibility.

---

---

[← Index](00-index.md) · [← Part 1 — Name & Strategy](01-strategy.md) · [Part 3 — Technology & Data →](03-technology.md)
