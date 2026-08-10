import { formatIst } from "@/domain/format"
import { toE164 } from "@/domain/identifiers"
import { formatPaise } from "@/domain/money"
import { whatsAppConfig } from "./config.ts"

/**
 * WhatsApp Business, which §4.5 calls the primary channel — not push.
 *
 * The reasoning there is worth keeping in view while reading this file: Indian
 * users disable push and do not open a charter app between trips, which for a
 * wedding is once a year. They do read WhatsApp. So booking confirmations,
 * driver details, tracking links, payment reminders and invoices go here, and
 * push is reserved for in-session urgency the app does not yet have.
 *
 * Two things constrain the shape of everything below.
 *
 * **Templates are pre-approved, not free text.** Outside a 24-hour customer
 * service window, a business may only send a template registered with Meta,
 * with variables filled positionally. So a message is a template name plus an
 * ordered list of strings, and the copy lives with Meta rather than here —
 * what this file owns is which variables go in which order.
 *
 * **Every send is a row first.** The outbox is written before the API call, so
 * a failure is visible instead of lost, and "did the customer ever get the
 * driver's details" is answerable without asking the customer.
 */

export const TEMPLATES = {
  bookingConfirmed: "toli_booking_confirmed",
  driverDetails: "toli_driver_details",
  trackingLink: "toli_tracking_link",
  paymentReminder: "toli_payment_reminder",
  invoiceReady: "toli_invoice_ready",
} as const

export type TemplateName = (typeof TEMPLATES)[keyof typeof TEMPLATES]

export type Message = {
  template: TemplateName
  toPhone: string
  /** Positional template variables, in the order the registered template expects. */
  variables: string[]
}

/**
 * The messages this app sends, each built in one place.
 *
 * Pure functions returning a `Message`, which is what makes them testable
 * without a BSP account: the thing that can be wrong here is the *order* of
 * the variables, and an invoice total appearing where a vehicle number should
 * be is exactly the kind of error nobody notices until a customer does.
 */
export const compose = {
  bookingConfirmed(input: {
    customerPhone: string
    customerName: string
    reference: string
    vehicleDescription: string
    departAt: Date
    totalPaise: number
  }): Message {
    return {
      template: TEMPLATES.bookingConfirmed,
      toPhone: toE164(input.customerPhone),
      variables: [
        input.customerName,
        input.reference,
        input.vehicleDescription,
        formatIst(input.departAt),
        formatPaise(input.totalPaise),
      ],
    }
  },

  /**
   * §4.1 releases vehicle and driver details at T-12h.
   *
   * The driver's number is in the message because a passenger standing outside
   * at 5 AM needs it. Masking it through cloud telephony is §10's answer and a
   * separate integration; until that exists this is the honest trade, and it
   * is recorded in the outbox either way.
   */
  driverDetails(input: {
    customerPhone: string
    reference: string
    driverName: string
    driverPhone: string
    vehicleRegistration: string
    trackingUrl: string
  }): Message {
    return {
      template: TEMPLATES.driverDetails,
      toPhone: toE164(input.customerPhone),
      variables: [
        input.reference,
        input.driverName,
        `+${toE164(input.driverPhone)}`,
        input.vehicleRegistration,
        input.trackingUrl,
      ],
    }
  },

  /** The link a customer forwards to sixty guests — §4.1's best acquisition channel. */
  trackingLink(input: { toPhone: string; reference: string; trackingUrl: string }): Message {
    return {
      template: TEMPLATES.trackingLink,
      toPhone: toE164(input.toPhone),
      variables: [input.reference, input.trackingUrl],
    }
  },

  paymentReminder(input: {
    customerPhone: string
    reference: string
    amountPaise: number
    payUrl: string
    departAt: Date
  }): Message {
    return {
      template: TEMPLATES.paymentReminder,
      toPhone: toE164(input.customerPhone),
      variables: [
        input.reference,
        formatPaise(input.amountPaise),
        formatIst(input.departAt),
        input.payUrl,
      ],
    }
  },

  invoiceReady(input: {
    customerPhone: string
    reference: string
    invoiceNumber: string
    totalPaise: number
  }): Message {
    return {
      template: TEMPLATES.invoiceReady,
      toPhone: toE164(input.customerPhone),
      variables: [input.reference, input.invoiceNumber, formatPaise(input.totalPaise)],
    }
  },
}

export type SendResult = { providerRef: string }

/**
 * Hands a composed message to the Cloud API.
 *
 * `language: en` because §4.1 ships English and Hindi first and the i18n
 * plumbing belongs on day one — a template is registered per language, so the
 * only change when Hindi copy is approved is which code is passed here.
 */
export async function send(message: Message, language = "en"): Promise<SendResult> {
  const config = whatsAppConfig()

  const response = await fetch(`${config.baseUrl}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: message.toPhone,
      type: "template",
      template: {
        name: message.template,
        language: { code: language },
        components: [
          {
            type: "body",
            parameters: message.variables.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })

  const text = await response.text()
  if (!response.ok) {
    let detail = text.slice(0, 400)
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: number } }
      if (parsed.error?.message) detail = `${parsed.error.code ?? ""} ${parsed.error.message}`
    } catch {
      // Not JSON; the raw body is the best clue available.
    }
    throw new Error(`WhatsApp ${response.status}: ${detail}`)
  }

  const body = JSON.parse(text) as { messages?: { id?: string }[] }
  return { providerRef: body.messages?.[0]?.id ?? "" }
}
