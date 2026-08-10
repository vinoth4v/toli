import { describe, expect, it } from "vitest"
import { computeGst, extractGstFromGross, GST_TREATMENTS } from "./gst.ts"

describe("computeGst", () => {
  it("splits intra-state tax into CGST and SGST that add back to the tax", () => {
    const gst = computeGst(2_840_000, "passenger_transport_5", true)

    expect(gst.taxPaise).toBe(142_000)
    expect(gst.cgstPaise + gst.sgstPaise).toBe(gst.taxPaise)
    expect(gst.igstPaise).toBe(0)
    expect(gst.totalPaise).toBe(2_982_000)
  })

  it("charges IGST when the place of supply is another state", () => {
    const gst = computeGst(2_840_000, "passenger_transport_5", false)

    expect(gst.igstPaise).toBe(142_000)
    expect(gst.cgstPaise).toBe(0)
    expect(gst.sgstPaise).toBe(0)
  })

  it("never loses the odd paisa when the tax does not halve cleanly", () => {
    const gst = computeGst(101, "passenger_transport_5", true)

    expect(gst.taxPaise).toBe(5)
    expect(gst.cgstPaise).toBe(3)
    expect(gst.sgstPaise).toBe(2)
    expect(gst.cgstPaise + gst.sgstPaise).toBe(gst.taxPaise)
  })

  it("carries all three treatments, because §8.3 is unresolved until counsel answers", () => {
    expect(GST_TREATMENTS.passenger_transport_5.rateBps).toBe(500)
    expect(GST_TREATMENTS.passenger_transport_5.inputTaxCredit).toBe(false)
    expect(GST_TREATMENTS.passenger_transport_12.inputTaxCredit).toBe(true)
    expect(GST_TREATMENTS.rental_with_operator_18.rateBps).toBe(1800)
    // The seven-point swing the plan warns about, in one assertion.
    expect(
      GST_TREATMENTS.rental_with_operator_18.rateBps - GST_TREATMENTS.passenger_transport_5.rateBps,
    ).toBe(1300)
  })
})

describe("extractGstFromGross", () => {
  it("recovers the taxable value from an all-inclusive quote", () => {
    const gst = extractGstFromGross(2_982_000, "passenger_transport_5", true)

    expect(gst.taxablePaise).toBe(2_840_000)
    expect(gst.totalPaise).toBe(2_982_000)
  })

  it("always reconciles: taxable plus tax equals the agreed price, exactly", () => {
    for (const gross of [1, 99, 12_345, 2_982_001, 88_888_888]) {
      for (const treatment of ["passenger_transport_5", "rental_with_operator_18"] as const) {
        const gst = extractGstFromGross(gross, treatment, true)
        expect(gst.taxablePaise + gst.taxPaise).toBe(gross)
        expect(gst.cgstPaise + gst.sgstPaise).toBe(gst.taxPaise)
      }
    }
  })
})
