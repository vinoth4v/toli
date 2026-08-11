import { describe, expect, it } from "vitest"
import {
  checkGstin,
  checkIndianMobile,
  checkRegistration,
  isValidPan,
  toE164,
} from "./identifiers.ts"

describe("checkGstin", () => {
  it("accepts a GSTIN whose check digit is right", () => {
    // Karnataka, checksum verified by the modulus-36 rule the portal uses.
    const result = checkGstin("29AAACR5055K1Z3")

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.stateName).toBe("Karnataka")
      expect(result.pan).toBe("AAACR5055K")
    }
  })

  it("catches the transposition a person copying off a certificate makes", () => {
    // Same characters, two swapped — length and format still pass, checksum does not.
    const good = checkGstin("29AAACR5055K1Z3")
    const typo = checkGstin("29AAACR5505K1Z3")

    expect(good.valid).toBe(true)
    expect(typo.valid).toBe(false)
    if (!typo.valid) expect(typo.reason).toContain("Check digit")
  })

  it("rejects an impossible state code before anything else", () => {
    const result = checkGstin("99AAACR5055K1Z3")

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain("state code")
  })

  it("rejects the wrong length and the wrong shape", () => {
    expect(checkGstin("29AAACR5055K1Z").valid).toBe(false)
    expect(checkGstin("29aaacr5055k1z5!").valid).toBe(false)
  })

  it("is case- and whitespace-forgiving, because people paste", () => {
    expect(checkGstin("  29aaacr5055k1z3  ").valid).toBe(true)
  })
})

describe("isValidPan", () => {
  it("accepts a well-formed PAN and rejects a malformed one", () => {
    expect(isValidPan("AAACR5055K")).toBe(true)
    expect(isValidPan("AAACR5055")).toBe(false)
    expect(isValidPan("AAAC5R055K")).toBe(false)
  })
})

describe("checkRegistration", () => {
  it("normalises the three ways operators write the same plate", () => {
    // Without this the unique index on registration means nothing: the same
    // vehicle gets added three times by three different people.
    for (const written of ["RJ 14 PA 4521", "RJ14PA4521", "rj-14-pa-4521"]) {
      const result = checkRegistration(written)
      expect(result.valid, written).toBe(true)
      if (result.valid) expect(result.normalised).toBe("RJ 14 PA 4521")
    }
  })

  it("pads a short district and a short serial to canonical form", () => {
    const result = checkRegistration("RJ5PA21")

    expect(result.valid).toBe(true)
    if (result.valid) expect(result.normalised).toBe("RJ 05 PA 0021")
  })

  it("reports the issuing state code", () => {
    const result = checkRegistration("MH12AB1234")

    expect(result.valid).toBe(true)
    if (result.valid) expect(result.stateCode).toBe("MH")
  })

  it("rejects something that is not a plate", () => {
    expect(checkRegistration("not a plate").valid).toBe(false)
    expect(checkRegistration("").valid).toBe(false)
  })
})

describe("checkIndianMobile", () => {
  it("accepts every way a customer writes their own number", () => {
    for (const written of [
      "9829011234",
      "+91 98290 11234",
      "098290-11234",
      "91 9829011234",
      "+919829011234",
    ]) {
      const result = checkIndianMobile(written)
      expect(result.valid, written).toBe(true)
      if (result.valid) expect(result.e164).toBe("919829011234")
    }
  })

  it("rejects a landline, which cannot receive a WhatsApp template", () => {
    const result = checkIndianMobile("01412345678")

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain("6, 7, 8 or 9")
  })

  it("rejects the wrong number of digits", () => {
    expect(checkIndianMobile("98290112").valid).toBe(false)
    expect(checkIndianMobile("98290112345678").valid).toBe(false)
  })

  it("throws rather than send a message to nowhere", () => {
    expect(() => toE164("01412345678")).toThrow()
    expect(toE164("+91 98290 11234")).toBe("919829011234")
  })
})
