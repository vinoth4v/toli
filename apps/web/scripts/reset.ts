/**
 * Empties every application table, so the database can be seeded again from
 * nothing.
 *
 * Destructive on purpose, and deliberately awkward: it refuses to run unless
 * `CONFIRM_RESET=yes` is set, because the difference between this and losing a
 * month of real bookings is one shell history entry.
 *
 * The table order is the foreign-key order reversed — children before parents
 * — and `audit_log` is excluded. The audit log is the one thing that should
 * survive a reset: it is the record that a reset happened.
 *
 *   CONFIRM_RESET=yes DATABASE_URL=... pnpm --filter web run db:reset
 */

import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

if (process.env.CONFIRM_RESET !== "yes") {
  console.error(
    "Refusing to wipe the database. Set CONFIRM_RESET=yes if that is genuinely what you want.",
  )
  process.exit(1)
}

const sql = neon(url)

/** Children first. Anything added later belongs at the top of this list. */
const TABLES = [
  "app_user",
  "notification",
  "webhook_event",
  "ingest_device",
  "geo_cache",
  "dispute",
  "review",
  "settlement",
  "invoice",
  "trip_expense",
  "location_ping",
  "trip_event",
  "assignment",
  "payment",
  "booking",
  "quote",
  "stop",
  "trip_request",
  "consent_record",
  "compliance_check",
  "vehicle_document",
  "driver",
  "vehicle",
  "operator",
  "customer",
  "platform_setting",
]

async function main(): Promise<void> {
  const before = await sql`select count(*)::int as count from booking`
  const bookings = (before[0]?.count as number | undefined) ?? 0

  console.log(`Wiping ${TABLES.length} tables (${bookings} booking(s) will be lost).`)

  for (const table of TABLES) {
    // `sql.query` is the escape hatch for an identifier that cannot be a
    // parameter. The table names are a fixed list in this file, never input.
    await sql.query(`delete from ${table}`)
  }

  await sql`insert into audit_log (kind, actor, detail) values ('settings_updated', 'reset script', 'Database reset and reseeded')`

  console.log("Done. Run db:seed and db:seed-users next.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
