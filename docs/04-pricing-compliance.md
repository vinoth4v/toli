# TOLI — Build Plan
### Part 4 — Pricing, Money & Compliance

*An aggregator marketplace for chartered vans, tempo travellers and buses in India.*
*Version 1.0 · 10 August 2026 · Part 4 of 5*

[← Index](00-index.md) · [← Part 3 — Technology & Data](03-technology.md) · [Part 5 — Risks, Roadmap & Execution →](05-execution.md)

---

## 7. The pricing engine

The heart of the marketplace. Model it explicitly rather than letting operators send free-text prices.

### 7.1 Canonical quote schema

```
Quote {
  base_fare              // for local packages: covers min hrs + min km
  included_km            // e.g. 80 km
  included_hours         // e.g. 8 hours
  extra_km_rate          // ₹/km beyond included
  extra_hour_rate        // ₹/hr beyond included
  per_km_rate            // for outstation: ₹/km, on a MINIMUM DAILY KM basis
  min_km_per_day         // typically 250-300 km/day — critical, often hidden
  driver_bata_per_day    // driver allowance, ₹300-800
  night_halt_charge      // ₹300-1000 per night
  toll_included          : bool
  parking_included       : bool
  state_permit_included  : bool   // interstate taxes; can be ₹5000+ per state
  fuel_included          : bool   // almost always true; flag rare exceptions
  gst_rate               // see §8.3
  estimated_total        // computed, shown prominently
  worst_case_total       // computed, shown honestly
  cancellation_policy_id
  validity_until         // quotes expire — 24-48h
}
```

**Making `min_km_per_day` and `state_permit_included` mandatory, visible fields is your product's single biggest customer-trust win.** These are the two charges that produce the classic Indian charter experience of a ₹28,000 quote turning into a ₹41,000 bill at the end of the trip.

### 7.2 Toli Fair Price band

Once you have ~2,000 quotes, compute a p25–p75 band per (route band × vehicle class × season) and show it on the comparison screen: *"Quotes for this trip usually fall between ₹24,000 and ₹31,000."* This is high-trust, easy to explain, and it disciplines operators without you setting prices (which would attract MVAG fare-regulation scrutiny you don't want yet).

### 7.3 Seasonality

Indian group travel is violently seasonal: wedding *muhurat* dates (Nov–Feb, Apr–Jun), school holidays, Char Dham yatra season (Apr–Oct), Diwali, Ganesh Chaturthi, exam-result travel. Build a **calendar-driven demand multiplier** into the pricing model and, more importantly, into your **supply planning** — on a peak wedding date, every tempo traveller in Jaipur is already booked, and your job is to have secured inventory two months earlier.

### 7.4 Take rate

Start at **8–12% commission** on trip value, charged to the operator, and be loudly transparent about it. Reference points: travel agents currently take 15–25%; MVAG 2025 sets the driver's minimum share at 80% for driver-owned vehicles, which effectively caps aggregator take at 20% in regulated ride-hailing. Undercutting agents visibly is your supply pitch. Additional revenue lines: instant settlement fee, featured placement, insurance attach, corporate SaaS subscription for the console.

---

---

## 8. Money flow, tax, and compliance

**Engage a chartered accountant and a transport-law counsel in month 1.** The items below are the structural decisions that shape your database schema and settlement code, so they cannot be deferred — but treat this section as the agenda for that conversation, not as legal advice.

### 8.1 Payment stack

- **Gateway:** Razorpay or Cashfree. Both offer marketplace split-settlement products (Razorpay Route, Cashfree Easy Split) that let you hold funds and release to operator sub-accounts — essential for advance/balance flows
- **Payouts:** RazorpayX or Cashfree Payouts, IMPS/NEFT/UPI to operator bank accounts
- **UPI is the default.** Support intent flow (deep-link to GPay/PhonePe/Paytm) and QR. Cards are a minority
- **Corporate:** invoice + NEFT with credit terms, PO reference field, monthly consolidated billing
- **Cash-to-driver balance:** model it. Driver marks cash collected in-app, it's reconciled against the operator's settlement. Half your first-year balance payments will be cash

### 8.2 The escrow question

You are not an RBI-licensed payment aggregator, so **do not hold customer money in your own current account** as a matter of routine — use the gateway's escrow/split product where funds sit in a nodal account until release. Release trigger: trip completion + 24h dispute window, or immediately for verified Tier-1 operators.

### 8.3 GST — the structural issue you must resolve before writing settlement code

Under **Section 9(5) of the CGST Act**, an electronic commerce operator can be *deemed to be the supplier* for notified services, including passenger transport supplied through the platform — meaning the platform, not the operator, pays GST on the whole fare, not merely on its commission. Notification 17/2017-CT(Rate) as amended by 16/2023 governs which vehicle categories fall in. Rates in play for passenger transport are typically 5% without input tax credit or 12% with ITC, while *rental of a vehicle with operator* is treated differently again at 18%.

**Whether your charter product is "transportation of passengers" or "rental of a motor vehicle" changes your tax rate, your ITC position, and your unit economics by 7 percentage points.** Get a written opinion. Then build the invoicing engine to handle both, with the applicable treatment as a configurable attribute per booking type.

Also in scope:
- **TCS under Section 52 CGST** (1% by ECOs) and **TDS under Section 194-O of the Income Tax Act** (1% on e-commerce participants) — both need automated deduction, deposit, and certificate generation
- **E-invoicing** thresholds, if applicable
- Operators below the registration threshold: Section 23(2) allows exemption from compulsory registration for small suppliers selling through an ECO paying under 9(5) — this matters a lot, because many of your smaller operators are unregistered

### 8.4 Motor Vehicle Aggregator Guidelines, 2025

MoRTH issued revised guidelines on 1 July 2025, superseding the 2020 framework, with states advised to adopt them from 1 October 2025. Key obligations if you fall in scope:

- **Licence from the State Transport Authority** under Section 93 of the Motor Vehicles Act, per state you operate in. A central single-window portal is planned. Applicant must be a company, LLP, cooperative society, or a compliant partnership firm — so **incorporate a Private Limited company early**
- **Security deposit** (bank guarantee or insurance surety bond)
- **Fare regulation:** dynamic pricing permitted within a band of 50% below to 2× the state-notified base fare; drivers who own their vehicle get at least 80% of the fare (60% for aggregator-owned)
- **Cancellation fee capped at ₹100** where cancellation lacks a valid reason, for either side
- **Driver requirements:** police verification, medical test, psychological assessment before onboarding; induction training plus annual refreshers
- **Grievance officer** appointed, with contact details displayed in-app
- **Divyangjan-accessible vehicles** required in the fleet mix; states may set EV adoption targets
- **Penalties** from ₹1 lakh to ₹1 crore; repeat violations mean 3-month suspension and eventual cancellation

**Important nuance to get counsel on:** the guidelines expressly exclude certain travel service portals and interoperable networks that do not onboard drivers and vehicles. A pure charter marketplace where the *operator* contracts with the passenger may sit differently from a ride-hailing aggregator. Your entity structure and terms of service should be designed with this in mind from the start, not retrofitted.

### 8.5 Vehicle and permit compliance

- **All India Tourist Permit** under the All India Tourist Vehicles (Permit) Rules, 2023 for interstate charter. For a tempo traveller, expect roughly ₹15,000–₹25,000 in permit fees plus per-state composite tax. Your platform must **block interstate bookings for vehicles without a valid AITP** — an operator caught without one faces up to ₹10,000 fine and vehicle detention under s.192A, and your passengers are stranded at a border check post at 2 AM
- **Vehicle age limits** apply (AITP typically not granted past 12 years from first registration; stricter in Delhi NCT for diesel). Encode as validation rules
- **AIS-140** VLTD device with panic buttons — mandatory for public service vehicles
- **Fitness certificate, commercial insurance, PUC** — track expiry, auto-suspend

### 8.6 Data protection

The **Digital Personal Data Protection Act, 2023** applies. Location data of passengers, driver Aadhaar/DL data, and payment identifiers are all sensitive. Requirements: explicit purpose-limited consent, a consent-withdrawal mechanism, breach notification, data retention limits, a Data Protection Officer once you cross scale thresholds. Practical build items: consent ledger table, PII encryption at rest, phone-number masking in all logs, per-field access control in the admin console, right-to-erasure workflow.

### 8.7 Insurance

- Verify each vehicle's commercial passenger insurance at onboarding and at renewal
- Offer per-passenger trip insurance as an attach product (revenue line, and a genuine trust signal for parents booking school trips)
- Carry your own professional indemnity and platform liability cover

---

---

[← Index](00-index.md) · [← Part 3 — Technology & Data](03-technology.md) · [Part 5 — Risks, Roadmap & Execution →](05-execution.md)
