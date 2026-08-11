import { eq, inArray } from "drizzle-orm"
import { generatePassword } from "@/auth/generate"
import { db } from "@/db/client"
import { appUser, customer, type Driver, driver } from "@/db/schema"
import { createOperator } from "./supply.ts"
import { createUser, findUserByEmail, normaliseEmail } from "./users.ts"

/**
 * Self-registration — three roles, three different shapes, on purpose.
 *
 * A customer walks in off the street and is served immediately: nothing about
 * booking a van needs a human to approve first. An operator *applies*: the row
 * is created `pending_verification`, they can sign in and load their fleet and
 * paperwork straight away, but nothing they own can be sold until Toli's
 * verification queue has looked at it — which is machinery that already
 * exists, so registration does not need its own gate. A driver does not
 * register at all: drivers belong to an operator (§3 — a driver who learns the
 * take rate disintermediates you), so their sign-in is issued by their
 * operator from the partner app, password shown once.
 */

/** A refusal whose message is written for the person on the form. */
export class RegistrationError extends Error {
  readonly code: "phone_taken" | "email_taken"

  constructor(code: "phone_taken" | "email_taken", message: string) {
    super(message)
    this.code = code
  }
}

async function requireFreeEmail(email: string): Promise<void> {
  if (await findUserByEmail(email)) {
    throw new RegistrationError(
      "email_taken",
      "That email already has a Toli account. Sign in instead.",
    )
  }
}

export async function registerCustomer(input: {
  name: string
  phone: string
  email: string
  city: string
  password: string
}): Promise<{ email: string }> {
  const email = normaliseEmail(input.email)
  await requireFreeEmail(email)

  // A customer row for this phone may already exist — created by ops taking a
  // phone booking. Attaching a new sign-in to it would hand that person's trip
  // history to whoever typed the number, so the claim goes through a human.
  const existing = await db()
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.phone, input.phone))
    .limit(1)

  if (existing[0]) {
    throw new RegistrationError(
      "phone_taken",
      "This phone number is already with Toli. Sign in, or call us and we will link your trips to a new account.",
    )
  }

  const created = await db()
    .insert(customer)
    .values({
      name: input.name,
      phone: input.phone,
      email,
      city: input.city,
      gstin: null,
      segment: "consumer",
    })
    .returning({ id: customer.id })

  const row = created[0]
  if (!row) throw new Error("customer could not be created")

  await createUser({
    email,
    name: input.name,
    role: "customer",
    password: input.password,
    customerId: row.id,
  })

  return { email }
}

export async function registerOperator(input: {
  businessName: string
  contactName: string
  city: string
  phone: string
  email: string
  password: string
}): Promise<{ email: string }> {
  const email = normaliseEmail(input.email)
  await requireFreeEmail(email)

  // Status defaults to pending_verification in the schema, which is the whole
  // application model: they can sign in today, sell nothing until verified.
  const created = await createOperator({
    name: input.businessName,
    city: input.city,
    contactName: input.contactName,
    phone: input.phone,
    email,
    pan: null,
    gstin: null,
    commissionBps: null,
    notes: "Self-registered through toli.in — verify before first listing.",
  })

  await createUser({
    email,
    name: input.contactName,
    role: "operator",
    password: input.password,
    operatorId: created.id,
  })

  return { email }
}

/** Which of an operator's drivers already have a sign-in, by driver id. */
export async function driverLogins(driverIds: string[]): Promise<Map<string, string>> {
  if (driverIds.length === 0) return new Map()

  const rows = await db()
    .select({ driverId: appUser.driverId, email: appUser.email })
    .from(appUser)
    .where(inArray(appUser.driverId, driverIds))

  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.driverId) map.set(row.driverId, row.email)
  }
  return map
}

/**
 * Issues a driver's sign-in, on the operator's screen, password shown once.
 *
 * The email is synthesised from the phone number because most drivers in this
 * market do not have one, and the sign-in form asks for an email. It is an
 * identifier, not a mailbox — nothing is ever sent to it, and the screen that
 * shows it says so.
 */
export async function createDriverLogin(
  operatorId: string,
  driverId: string,
): Promise<{ driver: Driver; email: string; password: string }> {
  const rows = await db().select().from(driver).where(eq(driver.id, driverId)).limit(1)
  const found = rows[0]

  // Ownership in the WHERE-equivalent: an operator can only issue sign-ins to
  // their own drivers, whatever id the form posted.
  if (!found || found.operatorId !== operatorId) {
    throw new Error("driver not found for this operator")
  }

  const digits = found.phone.replace(/\D/g, "").slice(-10)
  const email = `d${digits}@drivers.toli.in`

  if (await findUserByEmail(email)) {
    throw new RegistrationError(
      "email_taken",
      "This driver already has a sign-in. Toli ops can reset the password.",
    )
  }

  const password = generatePassword()

  await createUser({
    email,
    name: found.name,
    role: "driver",
    password,
    driverId: found.id,
  })

  return { driver: found, email, password }
}
