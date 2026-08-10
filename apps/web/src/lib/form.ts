import { parseRupees } from "./money.ts"

/**
 * Reading a form, once, the same way everywhere.
 *
 * Server actions receive FormData, whose values are `string | File | null`.
 * Every one of these narrows to something the rest of the app can use, and
 * returns a miss as null rather than as an empty string that later reads as
 * a deliberate blank.
 */

export function textField(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value.trim() : ""
}

export function optionalField(form: FormData, name: string): string | null {
  const value = textField(form, name)
  return value === "" ? null : value
}

export function checkboxField(form: FormData, name: string): boolean {
  // An unchecked box is absent from the submission entirely.
  return form.get(name) !== null
}

/** A whole number, or null if the field was blank or not a number. */
export function intField(form: FormData, name: string): number | null {
  const value = textField(form, name).replace(/,/g, "")
  if (value === "" || !/^\d+$/.test(value)) return null
  return Number.parseInt(value, 10)
}

/** A rupee amount, returned in paise. Blank counts as zero, not as missing. */
export function rupeeField(form: FormData, name: string): number | null {
  const value = textField(form, name)
  if (value === "") return 0
  return parseRupees(value)
}

/** ISO calendar date as typed by <input type="date">, or null. */
export function dateField(form: FormData, name: string): string | null {
  const value = textField(form, name)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}
