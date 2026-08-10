# TOLI — Build Plan
### Part 1 — Name & Strategy

*An aggregator marketplace for chartered vans, tempo travellers and buses in India.*
*Version 1.0 · 10 August 2026 · Part 1 of 5*

[← Index](00-index.md) · [Part 2 — Product Scope →](02-product-scope.md)

---

## 0. Name

**Toli** (टोली) — Hindi for *a band of people moving together*.

Why it works:
- **Semantically exact.** This product does not sell a ride; it sells a group moving as one unit. *Toli* is the closest word in any Indian language to that idea, and no competitor owns it.
- **Warm, not corporate.** It carries the everyday feeling of *bachchon ki toli*, *Holi ki toli* — people who set out together. That is the emotional register of a wedding party, a pilgrimage group, an office offsite.
- **Speaks naturally in a sentence.** *"Toli se book kar liya."* Two syllables, easy for a driver, a fleet owner, and an app-store listing alike.
- **Clean of collisions.** Not competing for mindshare with RedBus, Chalo, Zingbus, Namma Yatri, Sarathi or Vahan.

**Wordmark:** `toli` in lowercase. Tagline: *"Poori toli, ek gaadi."* (The whole group, one vehicle.) English-market variant: *"Book for the whole group."*

**The one weakness to manage:** *toli* is a Hindi-belt word with weaker instant recognition in Tamil Nadu, Kerala, Karnataka and Andhra/Telangana. Two mitigations:
1. Launch north-and-west first (Jaipur → Delhi NCR → Udaipur → Ahmedabad), which is where your Phase 1 corridor sits anyway. By the time you enter the South, the brand carries its own meaning.
2. Pair the wordmark with a **visual group mark** — a cluster of figures, or a row of seats — so the meaning is legible before the word is understood.

**Product naming, applied consistently:**

| Surface | Name |
|---|---|
| Customer app | **Toli** |
| Operator app + web console | **Toli Partner** |
| Driver app | **Toli Driver** |
| Internal admin | **Toli Admin** |
| Price transparency feature | **Toli Fair Price** |
| Corporate product (Phase 3) | **Toli for Business** |

**Alternates**, held in reserve in case of a trademark conflict:

| Name | Meaning / angle |
|---|---|
| **Prayaan** | "to set out on a journey" (Sanskrit); travels furthest across India — *prayanam* in Telugu/Malayalam, *prayana* in Kannada |
| **Mandali** | a troupe or company of people; group-specific in Hindi, Marathi, Gujarati |
| **Rathya** | from *rath* (chariot); premium register, suits the corporate and wedding end |
| **GroupGaadi** | plainly descriptive, strong SEO value, zero brand ambiguity |

**Before you commit, in week 1:** a Class 39 (transport and travel arrangement) trademark search on ipindia.gov.in; an MCA company-name reservation; and registration of `toli.in`, `toli.co.in` and the closest available `.com` (a four-letter dictionary-adjacent `.com` will likely be held by a domain investor — budget for it or pick a compound such as `tolitravel.com`), plus the handle on Instagram, YouTube and WhatsApp Business. Renaming after launch costs far more than it looks like it will.

---

---

## 1. The single most important strategic decision

> **Do not build Uber. Build a marketplace with an RFQ engine.**

You asked for "Uber-like." That framing will cost you a year if taken literally, because the underlying transaction is fundamentally different:

| | Uber / Ola (cabs) | Group charter (vans + buses) |
|---|---|---|
| Booking horizon | 3 minutes ahead | 3 days to 3 months ahead |
| Unit sold | A seat, right now | A whole vehicle, for a duration |
| Price formation | Algorithm decides, take it or leave it | Negotiated; operator quotes, customer compares |
| Trip shape | A → B, 20 minutes | Multi-day, multi-stop, multi-state, driver stays with group |
| Cost components | One fare | Base + per-km + driver bata + night halt + toll + parking + interstate permit tax |
| Supply | Individual driver-owners | Fleet businesses with 3–200 vehicles and an office manager |
| Trust driver | Rating + ETA | Vehicle condition, driver behaviour, whether they show up at 4 AM |
| Cancellation cost | ₹0 | ₹15,000 wedding disaster |

So the product's heart is a **structured quote-and-award engine**, with instant booking layered on top *later* once you have enough rate-card data to price confidently yourself.

### The three-lane booking model

Build all three, in this order:

1. **Lane A — Assisted RFQ (launch with this).** Customer posts a requirement → your system fans it out to matched operators → operators respond with structured quotes → customer compares apples-to-apples → books with advance payment. You get liquidity and, crucially, a **pricing dataset**.
2. **Lane B — Instant Book (month 6+).** For high-frequency, well-understood lanes (airport transfers, Delhi–Jaipur, local 8hr/80km packages), you publish a Toli rate and auto-assign to an operator who has pre-committed inventory. This is the Uber-like experience, and it only becomes safe once Lane A has taught you real prices.
3. **Lane C — Contracts (month 10+).** Corporate employee transport, school routes, factory shifts, monthly hotel tie-ups. Recurring revenue, low CAC, and the highest-margin part of this business. Most Indian bus-tech companies eventually discover this is where the money actually is.

### Charter vs. seat-selling

Your description ("multi-seat vans and bus for large number of people") is **charter** — the group takes the whole vehicle. That's the right wedge: RedBus owns per-seat intercity ticketing and you will not beat them there. Keep per-seat selling out of scope until Phase 4, where it appears as *empty-leg selling* (an operator returning empty from a wedding sells the seats back) — which is a genuinely differentiated product only an aggregator can build.

---

---

## 2. Who you are building for

### Demand side (5 segments, deliberately ordered)

| Segment | Trip shape | Why start here / why not |
|---|---|---|
| **Weddings & family functions** | 2–5 days, 2–15 vehicles, guest ferrying, high emotion, high budget | **Start here.** Highest willingness to pay, worst current experience, seasonal but predictable |
| **Corporate offsites & events** | 1–3 days, invoice-driven, GST invoice mandatory | **Start here too.** They pay by NEFT, need a proper invoice, low haggling |
| **Pilgrimage & religious groups** | 4–12 days, price-sensitive, repeat annually, community-organised | High volume, thin margin, but incredible word-of-mouth |
| **School / college trips** | Safety-first, compliance-heavy, committee decision-making | Phase 3 — needs verified driver records and parent-facing tracking |
| **Employee daily transport** | Recurring monthly contracts | Phase 3–4 — highest LTV, longest sales cycle |

### Supply side

Indian tempo-traveller and bus operators are **not gig drivers**. They are small businesses. Typical profile: 4–30 vehicles, run by an owner and one dispatcher, currently getting bookings via WhatsApp, phone calls, and a network of travel agents who take 15–25% commission for doing nothing but forwarding a phone number.

**Your actual value proposition to them is not "more bookings."** It's:
1. **Getting rid of the agent's cut** — you charge less and you're transparent about it.
2. **Guaranteed payment** — agents delay payment 30–90 days. You settle in T+2. This alone will win you supply.
3. **Utilisation** — fill the empty return legs.
4. **A free dispatch tool** — most of them run their fleet on a paper diary. Give them the operator app free and they will stay for the tool even when they're grumbling about commission.

**Supply comes first.** Do not build a customer app until you have 40 verified vehicles signed in one city. A demand-side app with no supply is a very expensive way to disappoint people.

---

---

[← Index](00-index.md) · [Part 2 — Product Scope →](02-product-scope.md)
