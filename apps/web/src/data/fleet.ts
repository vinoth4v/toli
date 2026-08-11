import { randomBytes } from "node:crypto"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import { type VehiclePhoto, vehicle, vehicleDocument, vehiclePhoto } from "@/db/schema"
import type { DocumentKind } from "@/domain/compliance"
import { type Segment, segmentFor } from "@/domain/segment"
import type { VehicleClass } from "@/domain/vehicle"

/**
 * What an operator may do to their own fleet.
 *
 * Every function takes the operator id from the session and puts it in the
 * WHERE clause, exactly as `data/scoped.ts` does — an operator editing another
 * operator's vehicle is the failure this file is shaped to make impossible.
 *
 * A vehicle added here starts `pending_verification`, never `active`. §4.2 is
 * unambiguous that documents are checked before a vehicle carries anyone, and
 * letting an operator self-certify would hollow out the one rule this
 * marketplace enforces hardest.
 */

export async function addOwnVehicle(input: {
  operatorId: string
  registrationNumber: string
  vehicleClass: VehicleClass
  seats: number
  ac: boolean
  yearOfManufacture: number
  fuelType: string | null
  features: string[]
}): Promise<{ id: string; segment: Segment }> {
  // Segment is derived from what the vehicle has, never from what was typed.
  const segment = segmentFor({ ac: input.ac, features: input.features })

  const created = await db()
    .insert(vehicle)
    .values({
      operatorId: input.operatorId,
      registrationNumber: input.registrationNumber,
      vehicleClass: input.vehicleClass,
      seats: input.seats,
      ac: input.ac,
      yearOfManufacture: input.yearOfManufacture,
      fuelType: input.fuelType,
      features: input.features,
      segment,
      status: "pending_verification",
    })
    .returning({ id: vehicle.id })

  const row = created[0]
  if (!row) throw new Error("vehicle could not be added")
  return { id: row.id, segment }
}

/**
 * Removing a vehicle retires it; it never deletes.
 *
 * A vehicle that carried passengers is attached to bookings, settlements and
 * a compliance history, and those have to remain answerable long after the
 * bus is sold. `retired` is terminal in the §9 state machine, so a retired
 * vehicle cannot come back without going through verification again.
 */
export async function retireOwnVehicle(operatorId: string, vehicleId: string): Promise<void> {
  await db()
    .update(vehicle)
    .set({ status: "retired", suspensionReason: "Retired by the operator" })
    .where(and(eq(vehicle.id, vehicleId), eq(vehicle.operatorId, operatorId)))
}

/** True when this vehicle is this operator's — the check every write makes. */
export async function ownsVehicle(operatorId: string, vehicleId: string): Promise<boolean> {
  const rows = await db()
    .select({ id: vehicle.id })
    .from(vehicle)
    .where(and(eq(vehicle.id, vehicleId), eq(vehicle.operatorId, operatorId)))
    .limit(1)

  return rows.length > 0
}

export async function addOwnDocument(input: {
  operatorId: string
  vehicleId: string
  kind: DocumentKind
  number: string | null
  expiresOn: string | null
}): Promise<boolean> {
  if (!(await ownsVehicle(input.operatorId, input.vehicleId))) return false

  await db().insert(vehicleDocument).values({
    vehicleId: input.vehicleId,
    kind: input.kind,
    number: input.number,
    expiresOn: input.expiresOn,
  })

  return true
}

/* --------------------------------------------------------------- photos */

export async function photosFor(vehicleIds: string[]): Promise<VehiclePhoto[]> {
  if (vehicleIds.length === 0) return []
  return db()
    .select()
    .from(vehiclePhoto)
    .where(inArray(vehiclePhoto.vehicleId, vehicleIds))
    .orderBy(desc(vehiclePhoto.uploadedAt))
}

export async function addPhoto(input: {
  operatorId: string
  vehicleId: string
  kind: VehiclePhoto["kind"]
  url: string
  storageKey: string | null
  caption: string | null
}): Promise<boolean> {
  if (!(await ownsVehicle(input.operatorId, input.vehicleId))) return false

  await db().insert(vehiclePhoto).values({
    vehicleId: input.vehicleId,
    kind: input.kind,
    url: input.url,
    storageKey: input.storageKey,
    caption: input.caption,
  })

  return true
}

export async function removePhoto(operatorId: string, photoId: string): Promise<void> {
  const rows = await db()
    .select({ vehicleId: vehiclePhoto.vehicleId })
    .from(vehiclePhoto)
    .where(eq(vehiclePhoto.id, photoId))
    .limit(1)

  const found = rows[0]
  if (!found || !(await ownsVehicle(operatorId, found.vehicleId))) return

  await db().delete(vehiclePhoto).where(eq(vehiclePhoto.id, photoId))
}

/** A random component for a storage key, so no upload overwrites another. */
export function uploadToken(): string {
  return randomBytes(9).toString("base64url")
}
