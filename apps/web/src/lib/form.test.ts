import { describe, expect, it } from "vitest"
import { checkboxField, dateField, intField, optionalField, rupeeField, textField } from "./form.ts"

function form(values: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.append(key, value)
  return data
}

describe("textField", () => {
  it("trims, and reads a missing field as blank", () => {
    expect(textField(form({ name: "  Sharma Travels " }), "name")).toBe("Sharma Travels")
    expect(textField(form({}), "name")).toBe("")
  })
})

describe("optionalField", () => {
  it("tells a blank apart from a value", () => {
    expect(optionalField(form({ gstin: "" }), "gstin")).toBeNull()
    expect(optionalField(form({ gstin: "08ABCDE1234F1Z5" }), "gstin")).toBe("08ABCDE1234F1Z5")
  })
})

describe("checkboxField", () => {
  it("is true only when the box was submitted", () => {
    expect(checkboxField(form({ tollsIncluded: "on" }), "tollsIncluded")).toBe(true)
    expect(checkboxField(form({}), "tollsIncluded")).toBe(false)
  })
})

describe("intField", () => {
  it("reads a whole number, with or without grouping", () => {
    expect(intField(form({ passengers: "24" }), "passengers")).toBe(24)
    expect(intField(form({ km: "1,200" }), "km")).toBe(1200)
  })

  it("refuses anything that is not one", () => {
    expect(intField(form({ passengers: "" }), "passengers")).toBeNull()
    expect(intField(form({ passengers: "twelve" }), "passengers")).toBeNull()
    expect(intField(form({ passengers: "12.5" }), "passengers")).toBeNull()
    expect(intField(form({ passengers: "-3" }), "passengers")).toBeNull()
  })
})

describe("rupeeField", () => {
  it("returns paise, and treats a blank as zero", () => {
    expect(rupeeField(form({ base: "32,000" }), "base")).toBe(3_200_000)
    expect(rupeeField(form({ base: "" }), "base")).toBe(0)
  })

  it("returns null for something that is not an amount", () => {
    expect(rupeeField(form({ base: "call me" }), "base")).toBeNull()
  })
})

describe("dateField", () => {
  it("accepts what a date input submits, and nothing else", () => {
    expect(dateField(form({ startDate: "2026-08-03" }), "startDate")).toBe("2026-08-03")
    expect(dateField(form({ startDate: "03/08/2026" }), "startDate")).toBeNull()
    expect(dateField(form({}), "startDate")).toBeNull()
  })
})
