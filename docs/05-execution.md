# TOLI — Build Plan
### Part 5 — Risks, Roadmap & Execution

*An aggregator marketplace for chartered vans, tempo travellers and buses in India.*
*Version 1.0 · 10 August 2026 · Part 5 of 5*

[← Index](00-index.md) · [← Part 4 — Pricing, Money & Compliance](04-pricing-compliance.md)

---

## 10. The problems that will actually hurt you

### Disintermediation (leakage)
Your biggest existential threat. Customer and operator connect once, then transact directly on WhatsApp forever. Every Indian services marketplace fights this.

Countermeasures, in order of effectiveness:
1. **Number masking** via cloud telephony (Exotel/Knowlarity) until the booking is confirmed and paid
2. **Make the platform genuinely more useful than the relationship** — tracking link for guests, GST invoice, dispute recourse, guaranteed backup vehicle. These are things a WhatsApp deal cannot provide
3. **Operator-side carrot:** T+2 settlement and free dispatch software, both forfeited on off-platform dealing
4. **Detect it:** flag operators whose quote-to-book ratio drops abnormally, watch for repeat customers who stop returning after one trip with a particular operator
5. **Contractual:** off-platform clause in the operator agreement, enforced with delisting for repeat offenders

Accept that you will lose some. Design the take rate low enough that cheating isn't worth the friction.

### Cold start
Classic chicken-and-egg. Solution: **manual, unscalable, city-by-city**. Sign 40 vehicles in one city by walking into their offices. Run the first 200 bookings through a WhatsApp group and a spreadsheet before you write a line of matching code. You will learn more about the quote schema from 50 real negotiations than from six months of design.

### Quality variance
A ₹35,000 booking where the wrong vehicle turns up is a catastrophe, not a bad rating. Mitigations: vehicle photos verified against RC, year-of-manufacture displayed, mandatory pre-departure photo by driver, **backup vehicle guarantee** (contract 3–5 float vehicles per city yourself — this is worth the cost), and a compensation policy published upfront.

### Seasonality and cash flow
Nov–Feb and Apr–Jun are wedding season; monsoon months are dead. You need working capital to survive Jul–Sep. Model this in the financial plan or you will have a payroll crisis in your first August.

### Safety
Group transport means women travelling at night, children on school trips, and elderly pilgrims on mountain roads. One serious incident, handled badly, ends the company. Non-negotiables from day one: SOS with a real 24×7 human on the other end, driver background verification, driving-hours limits enforced in software, night-driving speed alerts, incident escalation runbook, and an insurance policy you've actually read.

---

---

## 11. Roadmap

### Phase 0 — Validate without code (Weeks 1–6)

- Incorporate Pvt Ltd; open bank account; engage CA + transport counsel
- Pick **one city** — Jaipur, Delhi NCR, or Bengaluru. Jaipur is the sharpest wedge: enormous wedding + tourism charter demand, dense operator supply, manageable competition
- Sign 25–40 vehicles across 8–12 operators, on paper, with a signed rate card each
- Run **50 real bookings** through WhatsApp + Google Sheets + Razorpay payment links. Charge commission
- Land 2–3 corporate accounts for offsites
- **Output:** a validated quote schema, real rate data, 10 operator relationships, and a clear list of what actually breaks. Do not skip this phase.

**Team:** 2 founders + 1 ops person. **Cost:** ₹6–10L.

### Phase 1 — MVP (Months 2–6)

Ship: customer app (Android + iOS), operator app, driver app, admin console, one city, Lane A (RFQ) only.

Scope discipline — **in**: phone auth, requirement builder, RFQ fan-out, structured quotes, comparison, advance payment via UPI, booking confirmation, driver assignment, basic live tracking, shareable tracking link, GST invoice, ratings, admin verification queue, manual matching desk, settlement runs.

**Out**: instant book, dynamic pricing, in-app chat (use masked calling), loyalty, referrals, multi-language beyond Hindi/English, corporate SaaS, seat-selling.

Month-by-month:
- **M2:** architecture, design system, auth, entity model, operator onboarding + KYC + VAHAN integration
- **M3:** RFQ engine, quote schema, matching v1 (rules-based), operator app quoting flow
- **M4:** customer app booking flow, payments, invoicing, admin console
- **M5:** driver app, tracking service, tracking link, notifications (WhatsApp), settlement
- **M6:** hardening, load test, security review, store submission, 30-operator closed beta

**Team:** 1 EM, 3 backend, 2 Flutter, 1 Android, 1 React, 1 designer, 1 QA, 1 DevOps (part-time), 1 PM, 2 ops.
**Cost:** ₹85L – ₹1.3Cr including salaries.

### Phase 2 — Liquidity (Months 7–11)

- **Lane B instant book** on the top 15 routes, priced from Phase 1 data
- Fair Price band on comparison screen
- Operator rate cards → auto-quoting (targets response rate, the key marketplace metric)
- Empty-leg / return-leg marketplace
- Ratings-driven ranking; operator tiering (Bronze/Silver/Gold) with settlement-speed benefits
- Referrals and wedding-planner partner program
- 3 more cities in the same corridor (Jaipur → Delhi NCR → Agra → Udaipur; a corridor beats scattered cities because vehicles move between them)
- **AIS-140 VLTD feed ingestion**
- iOS parity, 4 more languages

**Metric target:** 60% quote-response rate within 30 min; 25% RFQ-to-booking conversion; 40% repeat rate for corporates.

### Phase 3 — Contracts & scale (Months 12–20)

- **Corporate portal:** cost centres, approval workflows, monthly consolidated billing, SSO, spend analytics
- **Recurring contracts:** employee transport, school routes, hotel tie-ups
- School-trip product with parent tracking access and enhanced driver verification
- ML matching and ETA correction models
- Operator financing partnerships (vehicle loans, fuel cards, insurance) — high-margin, high-retention
- 15–20 cities
- Aggregator licences in each operating state

### Phase 4 — Platform (Months 20+)

- Per-seat sale of empty legs (the differentiated version of RedBus, not the imitation)
- Open API for travel agents, wedding planners, event companies, hotel chains
- ONDC mobility integration
- EV fleet incentives, aligned with state EV targets under MVAG 2025
- Dynamic surge within regulatory bands

---

---

## 12. Team and budget

### Steady-state team (end of Phase 2)

| Function | Count |
|---|---|
| Engineering Manager / CTO | 1 |
| Backend engineers | 4 |
| Flutter engineers | 2 |
| Android (native, driver app) | 1 |
| Frontend (React) | 2 |
| Data engineer / analyst | 1 |
| QA | 1 |
| DevOps / SRE | 1 |
| Product Manager | 1 |
| Product Designer | 1 |
| **Product & Engineering** | **15** |
| City supply managers | 1 per city |
| Ops / booking desk | 4–6 |
| Customer support (24×7 rota) | 6 |
| Finance / compliance | 2 |
| Growth / marketing | 2 |

### Indicative budget (INR)

| Line | Phase 0–1 (6 mo) | Phase 2 (5 mo) |
|---|---|---|
| Engineering salaries | ₹75L – ₹1.1Cr | ₹1.2Cr – ₹1.6Cr |
| Ops & supply salaries | ₹12L | ₹35L |
| Infrastructure | ₹4L | ₹12L |
| Maps, SMS, WhatsApp, telephony | ₹3L | ₹15L |
| Legal, CA, licences, deposits | ₹8L – ₹15L | ₹15L |
| Marketing & supply incentives | ₹10L | ₹60L |
| Backup fleet contracts | ₹5L | ₹20L |
| **Total** | **₹1.2Cr – ₹1.6Cr** | **₹2.8Cr – ₹3.6Cr** |

A pre-seed of ₹3–4Cr gets you through Phase 2 with runway to raise on real liquidity metrics.

---

---

## 13. Metrics that matter

**Marketplace health (watch weekly)**
- Quote response rate — % of RFQs receiving ≥3 quotes within 30 minutes. *This is the metric. If it falls below 50%, nothing else matters.*
- Time to first quote (target: <10 min)
- RFQ → booking conversion (target: 25%+)
- Supply utilisation — % of listed vehicle-days booked

**Operational trust**
- On-time vehicle arrival % (target: >95%)
- Booking-to-execution match rate — right vehicle, right driver (target: >98%)
- Operator-initiated cancellation rate (target: <2%)
- SOS/incident rate per 1,000 trips
- Dispute rate and median resolution time

**Business**
- GMV, take rate, contribution margin per trip
- CAC by channel; LTV by segment
- Repeat rate at 90 days (corporates should exceed 50%)
- Leakage proxy: repeat-customer rate for customers who have used a given operator once

**Anti-metrics — resist optimising these**
- App downloads (a wedding is booked once a year; installs are a vanity number)
- Raw operator count (30 responsive operators beat 300 dormant ones)

---

---

## 14. Immediate next steps

1. **This week:** trademark search on "Toli" (Class 39), domain and handle registration, MCA name reservation
2. **Week 2:** incorporate; engage CA (specifically on the §8.3 GST classification question) and transport counsel (on the §8.4 aggregator-licence scope question)
3. **Weeks 2–6:** run Phase 0 manually in one city. 50 bookings, no code
4. **Week 4:** hire the EM/CTO; they should be someone who has shipped a marketplace, not just an app
5. **Week 6:** freeze the quote schema based on what Phase 0 taught you, then start building
6. **Month 2:** Google Maps Platform India billing account, Razorpay/Cashfree marketplace account, WhatsApp Business API via a BSP, VAHAN/Sarathi API access via an authorised aggregator
7. **Month 3:** apply for the state aggregator licence — assume 3–6 months of processing

---

*Regulatory details in §8 reflect published guidance as of mid-2026 and are summarised for planning purposes. Verify each with your CA and transport counsel before it becomes a line of code or a line of a contract.*

---

[← Index](00-index.md) · [← Part 4 — Pricing, Money & Compliance](04-pricing-compliance.md)
