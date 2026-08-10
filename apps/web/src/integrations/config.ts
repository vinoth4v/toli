/**
 * What this app is wired to, and what it is not.
 *
 * Four of the five external systems Toli needs require an account somebody has
 * to open with a company: a gateway merchant account, a Maps Platform billing
 * account, a WhatsApp BSP, a VAHAN aggregator contract. Until those exist, the
 * right behaviour is to say so — on the screen, in the action, in the log —
 * and never to invent a plausible answer.
 *
 * That is the whole reason this file exists rather than each client reading
 * `process.env` where it stands. An integration is either configured, in which
 * case it makes a real call, or it is not, in which case the button that would
 * have called it is disabled with a sentence explaining which variable is
 * missing. There is no third state where something appears to work.
 *
 * Read lazily, never at module scope: `next build` must not need any of it.
 */

export type IntegrationKey = "payments" | "maps" | "routing" | "whatsapp" | "verification"

export type IntegrationStatus = {
  key: IntegrationKey
  label: string
  configured: boolean
  /** Variables this integration needs, and whether each is present. */
  variables: { name: string; present: boolean; required: boolean }[]
  /** What the operator gets when it is on, and what they lose while it is off. */
  enables: string
  whileOff: string
  /** Where the credential comes from, so the gap is actionable. */
  source: string
}

function read(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() !== "" ? value.trim() : undefined
}

export class NotConfiguredError extends Error {
  constructor(
    readonly integration: IntegrationKey,
    missing: string[],
  ) {
    super(
      `${integration} is not configured: set ${missing.join(", ")}. ` +
        "See apps/web/.env.example and docs/ARCHITECTURE.md.",
    )
    this.name = "NotConfiguredError"
  }
}

/* ---------------------------------------------------------------- payments */

export type RazorpayConfig = {
  keyId: string
  keySecret: string
  webhookSecret: string
  baseUrl: string
}

export function razorpayConfig(): RazorpayConfig {
  const keyId = read("RAZORPAY_KEY_ID")
  const keySecret = read("RAZORPAY_KEY_SECRET")
  const webhookSecret = read("RAZORPAY_WEBHOOK_SECRET")

  const missing = [
    ...(keyId ? [] : ["RAZORPAY_KEY_ID"]),
    ...(keySecret ? [] : ["RAZORPAY_KEY_SECRET"]),
    ...(webhookSecret ? [] : ["RAZORPAY_WEBHOOK_SECRET"]),
  ]
  if (!keyId || !keySecret || !webhookSecret) throw new NotConfiguredError("payments", missing)

  return {
    keyId,
    keySecret,
    webhookSecret,
    baseUrl: read("RAZORPAY_BASE_URL") ?? "https://api.razorpay.com/v1",
  }
}

/* -------------------------------------------------------------------- maps */

export type MapsConfig = {
  googleKey: string | undefined
  mapplsKey: string | undefined
}

/**
 * Maps is configured when *either* provider is present.
 *
 * §6.1 wants Google for urban autocomplete and Mappls for the village and
 * landmark addresses a pilgrimage charter actually goes to. One of the two is
 * enough to geocode; having both is what makes the fallback meaningful.
 */
export function mapsConfig(): MapsConfig {
  const googleKey = read("GOOGLE_MAPS_API_KEY")
  const mapplsKey = read("MAPPLS_REST_KEY")

  if (!googleKey && !mapplsKey) {
    throw new NotConfiguredError("maps", ["GOOGLE_MAPS_API_KEY", "MAPPLS_REST_KEY"])
  }

  return { googleKey, mapplsKey }
}

/* ----------------------------------------------------------------- routing */

/**
 * Self-hosted OSRM — §6.2's "big one".
 *
 * Every RFQ needs a distance for every quote, and the same volume on a
 * commercial API is ₹4–8 lakh a month against about ₹8,000 for one instance.
 * So routing is a separate integration from maps on purpose: the expensive
 * provider answers the numbers a user looks at, this one answers the hundreds
 * of thousands nobody sees.
 */
export function osrmBaseUrl(): string {
  const base = read("OSRM_BASE_URL")
  if (!base) throw new NotConfiguredError("routing", ["OSRM_BASE_URL"])
  return base.replace(/\/$/, "")
}

/* ---------------------------------------------------------------- WhatsApp */

export type WhatsAppConfig = {
  phoneNumberId: string
  accessToken: string
  baseUrl: string
}

export function whatsAppConfig(): WhatsAppConfig {
  const phoneNumberId = read("WHATSAPP_PHONE_NUMBER_ID")
  const accessToken = read("WHATSAPP_ACCESS_TOKEN")

  const missing = [
    ...(phoneNumberId ? [] : ["WHATSAPP_PHONE_NUMBER_ID"]),
    ...(accessToken ? [] : ["WHATSAPP_ACCESS_TOKEN"]),
  ]
  if (!phoneNumberId || !accessToken) throw new NotConfiguredError("whatsapp", missing)

  return {
    phoneNumberId,
    accessToken,
    baseUrl: read("WHATSAPP_API_BASE") ?? "https://graph.facebook.com/v21.0",
  }
}

/* ------------------------------------------------------------ verification */

export type VerificationConfig = {
  baseUrl: string
  apiKey: string
  provider: string
}

/**
 * VAHAN, Sarathi and the GSTN, reached through an authorised aggregator.
 *
 * None of the three is open: access is resold by KYC'd aggregators, and which
 * one is a commercial decision. So the client speaks a shape common to them —
 * POST a number, get a record back — and the base URL and provider name are
 * configuration rather than a hard-coded vendor.
 */
export function verificationConfig(): VerificationConfig {
  const baseUrl = read("VEHICLE_VERIFY_BASE_URL")
  const apiKey = read("VEHICLE_VERIFY_API_KEY")

  const missing = [
    ...(baseUrl ? [] : ["VEHICLE_VERIFY_BASE_URL"]),
    ...(apiKey ? [] : ["VEHICLE_VERIFY_API_KEY"]),
  ]
  if (!baseUrl || !apiKey) throw new NotConfiguredError("verification", missing)

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    provider: read("VEHICLE_VERIFY_PROVIDER") ?? "aggregator",
  }
}

/* ------------------------------------------------------------------ status */

function statusOf(
  key: IntegrationKey,
  label: string,
  variables: { name: string; required: boolean }[],
  meta: { enables: string; whileOff: string; source: string },
  configured: boolean,
): IntegrationStatus {
  return {
    key,
    label,
    configured,
    variables: variables.map((variable) => ({
      ...variable,
      present: read(variable.name) !== undefined,
    })),
    ...meta,
  }
}

/** Everything the Integrations screen shows. Never throws — this is the honest inventory. */
export function integrationStatuses(): IntegrationStatus[] {
  const has = (name: string) => read(name) !== undefined

  return [
    statusOf(
      "payments",
      "Payments — Razorpay",
      [
        { name: "RAZORPAY_KEY_ID", required: true },
        { name: "RAZORPAY_KEY_SECRET", required: true },
        { name: "RAZORPAY_WEBHOOK_SECRET", required: true },
        { name: "RAZORPAY_BASE_URL", required: false },
      ],
      {
        enables: "Payment links sent to customers, and captures recorded automatically by webhook.",
        whileOff: "Payments are recorded by hand after the money arrives, which still reconciles.",
        source: "dashboard.razorpay.com → Settings → API keys, and Webhooks for the secret",
      },
      has("RAZORPAY_KEY_ID") && has("RAZORPAY_KEY_SECRET") && has("RAZORPAY_WEBHOOK_SECRET"),
    ),
    statusOf(
      "maps",
      "Geocoding — Google Places, Mappls fallback",
      [
        { name: "GOOGLE_MAPS_API_KEY", required: false },
        { name: "MAPPLS_REST_KEY", required: false },
      ],
      {
        enables: "Stops resolved to coordinates, so tracking and deviation detection have a route.",
        whileOff: "Stops stay as text and coordinates are entered by hand when they are needed.",
        source: "Google Maps Platform with India billing; Mappls (MapmyIndia) console",
      },
      has("GOOGLE_MAPS_API_KEY") || has("MAPPLS_REST_KEY"),
    ),
    statusOf(
      "routing",
      "Routing — self-hosted OSRM",
      [{ name: "OSRM_BASE_URL", required: true }],
      {
        enables: "Road distance and duration for every quote, at about ₹8,000 a month.",
        whileOff: "Estimated km is typed in by whoever took the call.",
        source: "An OSRM instance on the India OSM extract — one 16 GB machine",
      },
      has("OSRM_BASE_URL"),
    ),
    statusOf(
      "whatsapp",
      "Notifications — WhatsApp Business",
      [
        { name: "WHATSAPP_PHONE_NUMBER_ID", required: true },
        { name: "WHATSAPP_ACCESS_TOKEN", required: true },
        { name: "WHATSAPP_API_BASE", required: false },
      ],
      {
        enables: "Booking confirmations, driver details and tracking links sent where people read.",
        whileOff: "Messages queue in the outbox and the ops desk sends them by hand.",
        source: "A WhatsApp Business Platform account, direct or through a BSP",
      },
      has("WHATSAPP_PHONE_NUMBER_ID") && has("WHATSAPP_ACCESS_TOKEN"),
    ),
    statusOf(
      "verification",
      "Document verification — VAHAN, Sarathi, GSTN",
      [
        { name: "VEHICLE_VERIFY_BASE_URL", required: true },
        { name: "VEHICLE_VERIFY_API_KEY", required: true },
        { name: "VEHICLE_VERIFY_PROVIDER", required: false },
      ],
      {
        enables: "A document checked against the government record, automatically, at upload.",
        whileOff:
          "An ops person reads the portal and records the answer — same table, same rules, slower.",
        source: "An authorised aggregator; access is resold, not public",
      },
      has("VEHICLE_VERIFY_BASE_URL") && has("VEHICLE_VERIFY_API_KEY"),
    ),
  ]
}

export function isConfigured(key: IntegrationKey): boolean {
  return integrationStatuses().find((status) => status.key === key)?.configured ?? false
}
