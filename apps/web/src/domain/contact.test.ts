import { describe, expect, it } from "vitest"
import { bookingEnquiry, mailtoLink, telLink, whatsappLink } from "./contact.ts"

describe("telLink", () => {
  it("builds a dialable link from the ways a number is written", () => {
    expect(telLink("+91 98420 11234")).toBe("tel:+919842011234")
    expect(telLink("9842011234")).toBe("tel:+919842011234")
  })

  it("keeps a landline, because an operator's office is one", () => {
    expect(telLink("0452 250 0100")).toBe("tel:+04522500100")
  })

  it("returns nothing rather than a broken link", () => {
    expect(telLink("12")).toBeNull()
    expect(telLink("")).toBeNull()
  })
})

describe("whatsappLink", () => {
  it("uses wa.me with the country code, as WhatsApp requires", () => {
    expect(whatsappLink("+91 98420 11234")).toBe("https://wa.me/919842011234")
  })

  it("writes the first message so the customer does not have to", () => {
    const link = whatsappLink(
      "9842011234",
      bookingEnquiry("TOLI-B-000002", "Madurai to Kodaikanal", "12 Aug"),
    )

    expect(link).toContain("https://wa.me/919842011234?text=")
    expect(decodeURIComponent(link ?? "")).toContain("TOLI-B-000002")
    expect(decodeURIComponent(link ?? "")).toContain("Madurai to Kodaikanal")
  })

  it("refuses a number too short to be one", () => {
    expect(whatsappLink("1234")).toBeNull()
  })
})

describe("mailtoLink", () => {
  it("builds a mailto, with a subject when given one", () => {
    expect(mailtoLink("help@toli.in")).toBe("mailto:help@toli.in")
    expect(mailtoLink("help@toli.in", "Booking TOLI-B-000002")).toContain(
      "subject=Booking%20TOLI-B-000002",
    )
  })

  it("returns nothing for something that is not an address", () => {
    expect(mailtoLink("not-an-address")).toBeNull()
  })
})
