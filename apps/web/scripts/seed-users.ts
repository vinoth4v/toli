/**
 * Creates the four sign-in accounts, one per role, and prints their passwords
 * exactly once.
 *
 * Passwords are generated here, never chosen and never stored in plaintext:
 * what goes into the database is a scrypt hash, and what goes to the terminal
 * is the only copy of the password that will ever exist. Losing it means
 * setting a new one, which is the correct property for a credential.
 *
 * Each account is linked to the thing it *is* on the other side of the app —
 * the operator account to an operator, the driver account to a driver, the
 * customer account to a customer — because §3's whole point is that these are
 * four different people, not one account with a dropdown.
 *
 *   DATABASE_URL=... pnpm --filter web run db:seed-users
 */

import { randomBytes } from "node:crypto"
import { neon } from "@neondatabase/serverless"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"
import { hashPassword } from "../src/auth/password.ts"
import * as schema from "../src/db/schema.ts"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set. See apps/web/.env.example.")
  process.exit(1)
}

const db = drizzle(neon(url), { schema })

/**
 * Readable but not guessable: five groups of four from an alphabet with no
 * vowels and no lookalike characters, which is about 90 bits. Somebody has to
 * type this on a phone once, and read it off a screen without confusing O for
 * 0 while doing it.
 */
const ALPHABET = "23456789bcdfghjkmnpqrstvwxz"

function password(): string {
  const bytes = randomBytes(20)
  const characters = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length])
  return [0, 4, 8, 12, 16].map((start) => characters.slice(start, start + 4).join("")).join("-")
}

async function main(): Promise<void> {
  const existing = await db.select({ id: schema.appUser.id }).from(schema.appUser)
  if (existing.length > 0) {
    console.error(
      `This database already has ${existing.length} account(s). ` +
        "Delete them first if you meant to reissue credentials.",
    )
    process.exit(1)
  }

  // Link each account to real seeded data, so signing in shows a populated app
  // rather than four empty screens.
  const operators = await db
    .select()
    .from(schema.operator)
    .where(eq(schema.operator.name, "Shekhawati Travels"))
    .limit(1)
  const drivers = await db
    .select()
    .from(schema.driver)
    .where(eq(schema.driver.name, "Ramesh Meena"))
    .limit(1)
  const customers = await db
    .select()
    .from(schema.customer)
    .where(eq(schema.customer.name, "Aditi Agarwal"))
    .limit(1)

  const operatorRow = operators[0]
  const driverRow = drivers[0]
  const customerRow = customers[0]

  if (!operatorRow || !driverRow || !customerRow) {
    console.error(
      "Run db:seed first — the accounts link to seeded operators, drivers and customers.",
    )
    process.exit(1)
  }

  const accounts = [
    {
      email: "admin@toli.in",
      name: "Toli Ops",
      role: "admin" as const,
      operatorId: null,
      driverId: null,
      customerId: null,
      surface: "/console",
    },
    {
      email: "aditi@example.in",
      name: customerRow.name,
      role: "customer" as const,
      operatorId: null,
      driverId: null,
      customerId: customerRow.id,
      surface: "/portal",
    },
    {
      email: "operator@shekhawati.in",
      name: operatorRow.contactName,
      role: "operator" as const,
      operatorId: operatorRow.id,
      driverId: null,
      customerId: null,
      surface: "/partner",
    },
    {
      email: "ramesh@driver.toli.in",
      name: driverRow.name,
      role: "driver" as const,
      operatorId: null,
      driverId: driverRow.id,
      customerId: null,
      surface: "/drive",
    },
  ]

  const issued: { email: string; role: string; password: string; surface: string }[] = []

  for (const account of accounts) {
    const secret = password()
    await db.insert(schema.appUser).values({
      email: account.email,
      name: account.name,
      role: account.role,
      passwordHash: hashPassword(secret),
      operatorId: account.operatorId,
      driverId: account.driverId,
      customerId: account.customerId,
    })

    issued.push({
      email: account.email,
      role: account.role,
      password: secret,
      surface: account.surface,
    })
  }

  console.log("\nFour accounts created. These passwords are shown once and are not stored.\n")
  for (const account of issued) {
    console.log(
      `  ${account.role.padEnd(9)} ${account.email.padEnd(26)} ${account.password}   → ${account.surface}`,
    )
  }
  console.log("")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
