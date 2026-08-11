import { describe, expect, it } from "vitest"
import { compose, TEMPLATES } from "./whatsapp.ts"

/**
 * What can go wrong in a template message without a BSP account is the *order*
 * of the variables — an invoice total appearing where a vehicle number belongs.
 * Nobody notices that until a customer does, so it is pinned here.
 */

const departAt = new Date("2026-12-01T00:30:00Z") // 06:00 IST

describe("compose.bookingConfirmed", () => {
  it("fills the template in the registered order", () => {
    const message = compose.bookingConfirmed({
      customerPhone: "+91 98290 11234",
      customerName: "Aditi Agarwal",
      reference: "TOLI-B-000001",
      vehicleDescription: "26-seat tempo traveller, AC",
      departAt,
      totalPaise: 1_596_000,
    })

    expect(message.template).toBe(TEMPLATES.bookingConfirmed)
    expect(message.toPhone).toBe("919829011234")
    expect(message.variables[0]).toBe("Aditi Agarwal")
    expect(message.variables[1]).toBe("TOLI-B-000001")
    expect(message.variables[2]).toBe("26-seat tempo traveller, AC")
    expect(message.variables[3]).toContain("IST")
    expect(message.variables[4]).toBe("₹15,960")
  })

  it("renders the departure in IST, not UTC", () => {
    // 00:30 UTC is 06:00 IST. A confirmation that says midnight would have a
    // wedding party standing outside six hours early.
    const message = compose.bookingConfirmed({
      customerPhone: "9829011234",
      customerName: "A",
      reference: "R",
      vehicleDescription: "V",
      departAt,
      totalPaise: 0,
    })

    expect(message.variables[3]).toContain("06:00")
    expect(message.variables[3]).toContain("01 Dec 2026")
  })
})

describe("compose.driverDetails", () => {
  it("normalises both phone numbers and carries the tracking link", () => {
    const message = compose.driverDetails({
      customerPhone: "098290-11234",
      reference: "TOLI-B-000001",
      driverName: "Ramesh Meena",
      driverPhone: "+91 98294 45566",
      vehicleRegistration: "RJ 14 PB 8890",
      trackingUrl: "https://toli-flame.vercel.app/track/n977c49d7gqngmbkbknk",
    })

    expect(message.toPhone).toBe("919829011234")
    expect(message.variables[2]).toBe("+919829445566")
    expect(message.variables[3]).toBe("RJ 14 PB 8890")
    expect(message.variables[4]).toContain("/track/")
  })
})

describe("compose.paymentReminder", () => {
  it("puts the amount and the pay link where the template expects them", () => {
    const message = compose.paymentReminder({
      customerPhone: "9829011234",
      reference: "TOLI-B-000001",
      amountPaise: 399_000,
      payUrl: "https://rzp.io/i/abc",
      departAt,
    })

    expect(message.variables[1]).toBe("₹3,990")
    expect(message.variables[3]).toBe("https://rzp.io/i/abc")
  })
})

describe("compose.invoiceReady", () => {
  it("carries the invoice number a corporate will quote back", () => {
    const message = compose.invoiceReady({
      customerPhone: "9829011234",
      reference: "TOLI-B-000001",
      invoiceNumber: "TOLI/2026-27/00001",
      totalPaise: 1_596_000,
    })

    expect(message.variables).toEqual(["TOLI-B-000001", "TOLI/2026-27/00001", "₹15,960"])
  })
})

describe("refusing to send into the void", () => {
  it("throws on a number that cannot receive WhatsApp", () => {
    // A landline queued as WhatsApp is a message nobody ever gets, and an
    // outbox row that says "sent".
    expect(() =>
      compose.trackingLink({
        toPhone: "0141 234 5678",
        reference: "TOLI-B-000001",
        trackingUrl: "https://example.test/track/x",
      }),
    ).toThrow(/Cannot message/)
  })
})
