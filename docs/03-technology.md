# TOLI — Build Plan
### Part 3 — Technology & Data

*An aggregator marketplace for chartered vans, tempo travellers and buses in India.*
*Version 1.0 · 10 August 2026 · Part 3 of 5*

[← Index](00-index.md) · [← Part 2 — Product Scope](02-product-scope.md) · [Part 4 — Pricing, Money & Compliance →](04-pricing-compliance.md)

---

## 5. Technology stack

### 5.1 Mobile — you said native, here's the honest recommendation

| Surface | Recommendation | Reasoning |
|---|---|---|
| Customer app | **Flutter** | Rich UI, one codebase for Android + iOS, near-native performance, excellent Google Maps plugins, large and affordable talent pool in India |
| Operator app | **Flutter** (shared design system with customer) | Same team can build both |
| Driver app | **Native Kotlin (Android only)** | Non-negotiable |
| Web consoles | React + TypeScript + Vite, TanStack Query, shadcn/ui | Standard, fast to hire |

**Why native Kotlin specifically for the driver app.** This is where "mobile native" genuinely matters. Reliable background location on Indian budget Android is a fight against OEM battery optimisation, Doze mode, and process death. You need `ForegroundService` with `FOREGROUND_SERVICE_LOCATION`, a `FusedLocationProviderClient` tuned to balance accuracy against battery, a `WorkManager` sync queue, a Room-backed offline buffer, and OEM-specific autostart-permission prompts (Xiaomi's MIUI in particular). Every cross-platform abstraction leaks here, and when it leaks your customer doesn't see the bus on the map — which is the one thing they're paying you for. Also: your APK must stay under ~15MB for install conversion on cheap devices.

**If you insist on fully native everywhere** (Kotlin + Swift for all three apps): expect roughly +60–70% mobile engineering cost and +3 months to MVP for a marginal UX gain on the customer side. My recommendation is to spend that budget on supply acquisition instead. Revisit fully-native for the customer app at Series A scale.

### 5.2 Backend

```
API Gateway (Kong / AWS ALB)
        │
   ┌────┴──────────────────────────────────────────┐
   │  Core Platform — NestJS (TypeScript)          │
   │  Modular monolith, module boundaries enforced │
   │   identity · catalog · rfq · quoting · booking│
   │   pricing · payments · settlement · ratings   │
   │   notifications · compliance · admin          │
   └────┬──────────────────────────────────────────┘
        │
   ┌────┴────────────┐  ┌──────────────────┐  ┌──────────────┐
   │ Tracking Svc    │  │ Matching Svc     │  │ Geo Svc      │
   │ Go — high write │  │ Python — scoring │  │ Go — OSRM,   │
   │ GPS ingest, WS  │  │ ranking, ETA ML  │  │ geocode cache│
   └─────────────────┘  └──────────────────┘  └──────────────┘

Data: PostgreSQL 16 + PostGIS (primary) · Redis (cache, locks, geo)
      TimescaleDB or ClickHouse (GPS history, analytics)
      S3-compatible object store (documents, photos)
      Redpanda/Kafka (event bus — from Phase 2)
```

**Start as a modular monolith.** Microservices at seed stage are a tax you cannot afford. Enforce module boundaries in code (NestJS modules, no cross-module DB access, events between modules) so you can split later when a specific module actually needs independent scaling. The only services worth extracting on day one are **tracking** (very different write profile — thousands of GPS points per second at scale) and **geo/routing** (CPU-bound, wants its own machines).

**Why NestJS/TypeScript:** shared DTOs with the React consoles, opinionated structure that survives team turnover, huge and inexpensive Indian talent pool. Go is a defensible alternative for the whole backend if your CTO prefers it — pick one and don't split the team's mental model.

### 5.3 Infrastructure

- **Cloud:** AWS Mumbai (ap-south-1) or GCP Mumbai. Data localisation matters for RBI payment data and DPDP compliance
- **Compute:** ECS Fargate or GKE Autopilot. Do not run your own Kubernetes control plane at this stage
- **CI/CD:** GitHub Actions → staging → prod. Fastlane for app store deploys
- **Observability:** OpenTelemetry → Grafana Cloud or Datadog; Sentry for mobile crashes; structured JSON logs
- **Feature flags:** Unleash or GrowthBook — you'll want city-by-city rollout
- **Environments:** dev, staging, prod. Seed staging with realistic Indian data, not `John Doe`

### 5.4 Estimated infra cost

| Stage | Monthly |
|---|---|
| MVP, 1 city, <500 trips/mo | ₹45,000 – ₹80,000 |
| 5 cities, ~5,000 trips/mo | ₹2.5L – ₹4L |
| 20 cities, ~40,000 trips/mo | ₹12L – ₹20L |

Maps and SMS/WhatsApp will be a larger share of this than compute. Budget accordingly.

---

---

## 6. Maps and location — the India-specific decisions

This deserves its own section because naive choices here will either bankrupt you or give you wrong ETAs.

### 6.1 Provider strategy: use three, abstract all of them

Build a `MapProvider` interface from day one with implementations you can swap per-capability and per-region. Never let provider SDK types leak into your domain code.

| Capability | Recommendation |
|---|---|
| **Map rendering (mobile)** | **Google Maps SDK.** Google cut Maps Platform prices for India-billed customers by up to 70% in 2024, bills in rupees, and the mobile Maps SDK sits in the free tier. Familiar to every Indian user |
| **Places autocomplete / geocoding (urban)** | **Google Places**, with session tokens and aggressive debouncing (fire at ≥3 chars, 300ms) |
| **Geocoding (rural, village-level, non-standard addresses)** | **Mappls (MapmyIndia).** Materially better on village names, landmark-based addresses, and small-town road networks — exactly the destinations a pilgrimage or wedding charter goes to. Their data underpins Indian government and ISRO systems. Use as fallback when Google confidence is low |
| **Bulk routing / distance matrix for quoting** | **Self-hosted OSRM or Valhalla** on an OpenStreetMap India extract. This is the big one — see below |
| **User-facing ETA and live traffic** | **Google Directions**, called sparingly |
| **Turn-by-turn navigation** | **Deep-link out** to Google Maps or Mappls Navigation. Do not build in-app navigation |

### 6.2 Why self-hosted routing is essential

Every RFQ fans out to 10–30 operators. Every quote needs a distance and duration estimate. Every price validation needs one. Every "is this operator near enough" check needs one. You will burn **hundreds of thousands of routing calls per month** on internal computation that the user never sees.

Run OSRM on the India OSM extract (~1.5GB PBF) on a single 16GB instance. Cost: about ₹8,000/month. The same volume on a commercial API: ₹4–8 lakh/month. Use commercial APIs only for the numbers a user actually looks at.

Cache aggressively: geocode results forever, route distances for common origin-destination pairs with a 30-day TTL, keyed on rounded coordinates.

### 6.3 Live tracking architecture

```
Driver app (Kotlin) ──10s GPS ping──▶ Tracking Service (Go)
       │                                      │
   offline buffer                    ┌────────┴────────┐
   (Room, replays)                   ▼                 ▼
                              Redis (latest)    TimescaleDB (history)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            Customer app (WebSocket)      Public tracking page (SSE)
```

- Snap GPS to road before display (raw pings on Indian roads look drunk)
- Detect: deviation from planned route, unexplained stops >20 min, overspeeding, harsh braking (accelerometer), night driving hours
- **Ingest AIS-140 VLTD feeds too.** All commercial passenger vehicles in India must carry an AIS-140-compliant tracking device with panic buttons. Many operators already have a telematics vendor. Ingesting that feed gives you tracking even when the driver's phone dies — which it will. Build a webhook/pull adapter layer for the common Indian VLTD vendors
- Retain GPS history for at least 90 days for dispute resolution and safety investigation

### 6.4 ETA quality

Google's ETA is tuned for cars. A 26-seat tempo traveller on a ghat road, or a 45-seat coach on a state highway, is meaningfully slower and stops more. Collect your own actual-vs-predicted data from trip one and train a correction model per (vehicle class × road class × time of day) once you have ~5,000 trips. **On-time arrival is the single trust metric this business lives on** — a wedding party stranded because your ETA was optimistic is a brand-ending event.

---

---

## 9. Data model — core entities

```
User ─┬─ CustomerProfile
      ├─ OperatorProfile ─┬─ Vehicle ─┬─ VehicleDocument (type, number, expiry, verification_status)
      │                   │           └─ VehicleAvailability (date ranges, blocks)
      │                   ├─ Driver ──── DriverDocument
      │                   ├─ RateCard (vehicle_class, route_band, season, rates…)
      │                   └─ BankAccount
      └─ AdminUser ──── Role ──── Permission

TripRequest (RFQ)
  ├─ Itinerary ──── Stop[] (sequence, place_id, lat/lng, arrival_window, halt_duration)
  ├─ VehicleRequirement[] (class, count, ac, features)
  ├─ ExtraRequirement[]
  └─ Quote[] ──── QuoteLineItem[]      // the §7.1 schema
       └─ Booking
            ├─ Payment[] (advance, balance, refund; mode, gateway_ref, status)
            ├─ Assignment[] (vehicle, driver, sub_contracted_to?)
            ├─ TripExecution ──┬─ TripEvent[] (started, stop_reached, completed, deviation, sos)
            │                  ├─ LocationPing[]      → TimescaleDB
            │                  └─ TripExpense[] (toll, parking, permit; receipt_url)
            ├─ Invoice ──── InvoiceLine[] (with GST breakup, SAC code)
            ├─ Settlement (gross, commission, tds, tcs, net, status, utr)
            ├─ Review[]
            └─ Dispute[] ──── DisputeEvidence[]

ComplianceCheck (entity_type, entity_id, source: VAHAN|SARATHI|GSTN, result, checked_at)
AuditLog (actor, action, entity, before, after, ip, timestamp)
ConsentRecord (user, purpose, granted_at, withdrawn_at)
```

Design notes:
- Money in **paise as integers**, never floats
- All timestamps UTC, render in IST
- Soft-delete everything financial; hard-delete only for DPDP erasure requests, with a tombstone
- `Vehicle` has a lifecycle state machine: `draft → pending_verification → active → suspended → retired`, with suspension reasons enumerated
- Every price shown to a user is snapshotted at display time — never recompute a historical price

---

---

[← Index](00-index.md) · [← Part 2 — Product Scope](02-product-scope.md) · [Part 4 — Pricing, Money & Compliance →](04-pricing-compliance.md)
