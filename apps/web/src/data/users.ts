import { asc, eq } from "drizzle-orm"
import { hashPassword } from "@/auth/password"
import { db } from "@/db/client"
import { type AppUser, appUser, customer, driver, operator } from "@/db/schema"
import type { Role } from "@/domain/roles"

/**
 * The user store.
 *
 * Addresses are lower-cased on the way in and on the way out, always. Sign-in
 * with a capital letter in an email is not a failure anybody should have to
 * diagnose, and a unique index only means what it should if the data is
 * normalised before it gets there.
 */

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const rows = await db()
    .select()
    .from(appUser)
    .where(eq(appUser.email, normaliseEmail(email)))
    .limit(1)

  return rows[0] ?? null
}

export async function recordSignIn(id: string): Promise<void> {
  await db().update(appUser).set({ lastSignInAt: new Date() }).where(eq(appUser.id, id))
}

export type NewUser = {
  email: string
  name: string
  role: Role
  password: string
  operatorId?: string | null
  driverId?: string | null
  customerId?: string | null
}

/**
 * Creates a user, refusing the combinations that would make no sense.
 *
 * An operator account with no operator behind it can sign in and then see
 * nobody's fleet; a driver account with no driver row has no trip to show. The
 * check is here rather than in a constraint so the message can say which link
 * is missing.
 */
export async function createUser(input: NewUser): Promise<AppUser> {
  const email = normaliseEmail(input.email)

  if (input.role === "operator" && !input.operatorId) {
    throw new Error("An operator account must be linked to an operator")
  }
  if (input.role === "driver" && !input.driverId) {
    throw new Error("A driver account must be linked to a driver")
  }
  if (input.role === "customer" && !input.customerId) {
    throw new Error("A customer account must be linked to a customer")
  }

  const created = await db()
    .insert(appUser)
    .values({
      email,
      name: input.name,
      role: input.role,
      passwordHash: hashPassword(input.password),
      operatorId: input.operatorId ?? null,
      driverId: input.driverId ?? null,
      customerId: input.customerId ?? null,
    })
    .returning()

  const row = created[0]
  if (!row) throw new Error(`user ${email} could not be created`)
  return row
}

export async function listUsers() {
  return db()
    .select({
      user: appUser,
      operatorName: operator.name,
      driverName: driver.name,
      customerName: customer.name,
    })
    .from(appUser)
    .leftJoin(operator, eq(appUser.operatorId, operator.id))
    .leftJoin(driver, eq(appUser.driverId, driver.id))
    .leftJoin(customer, eq(appUser.customerId, customer.id))
    .orderBy(asc(appUser.role), asc(appUser.email))
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  await db().update(appUser).set({ active }).where(eq(appUser.id, id))
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  await db()
    .update(appUser)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(appUser.id, id))
}
