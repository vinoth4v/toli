import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db/client"
import {
  transportOperator,
  type TransportOperatorRow,
  vehicle,
  type VehicleRow,
} from "@/db/schema"
import type { OperatorStatus } from "@/domain/status"

export async function listOperators(): Promise<TransportOperatorRow[]> {
  return db().select().from(transportOperator).orderBy(asc(transportOperator.name))
}

export async function getOperator(id: string): Promise<TransportOperatorRow | undefined> {
  const rows = await db()
    .select()
    .from(transportOperator)
    .where(eq(transportOperator.id, id))
    .limit(1)
  return rows[0]
}

export async function createOperator(
  values: typeof transportOperator.$inferInsert,
): Promise<TransportOperatorRow | undefined> {
  const rows = await db().insert(transportOperator).values(values).returning()
  return rows[0]
}

export async function setOperatorStatus(id: string, status: OperatorStatus): Promise<void> {
  await db().update(transportOperator).set({ status }).where(eq(transportOperator.id, id))
}

export async function listVehicles(operatorId: string): Promise<VehicleRow[]> {
  return db()
    .select()
    .from(vehicle)
    .where(eq(vehicle.operatorId, operatorId))
    .orderBy(asc(vehicle.registration))
}

export async function createVehicle(
  values: typeof vehicle.$inferInsert,
): Promise<VehicleRow | undefined> {
  const rows = await db().insert(vehicle).values(values).returning()
  return rows[0]
}

export async function setVehicleActive(id: string, active: boolean): Promise<void> {
  await db().update(vehicle).set({ active }).where(eq(vehicle.id, id))
}

export type QuotableVehicle = {
  vehicle: VehicleRow
  operator: TransportOperatorRow
}

/**
 * Every active vehicle belonging to a verified operator, with its operator
 * alongside.
 *
 * The quote builder needs both in one list: choosing a vehicle without seeing
 * whose it is, and at what rate, is how the wrong operator gets quoted. The
 * `verified` filter is the same rule `canQuote` states — enforced here so an
 * unverified operator cannot be picked in the first place, rather than being
 * offered and then refused.
 */
export async function listQuotableVehicles(): Promise<QuotableVehicle[]> {
  return db()
    .select({ vehicle, operator: transportOperator })
    .from(vehicle)
    .innerJoin(transportOperator, eq(vehicle.operatorId, transportOperator.id))
    .where(and(eq(transportOperator.status, "verified"), eq(vehicle.active, true)))
    .orderBy(asc(transportOperator.name), asc(vehicle.registration))
}
