import { and, asc, desc, eq, inArray, isNotNull, lte } from "drizzle-orm"
import { db } from "@/db/client"
import {
  complianceCheck,
  type Driver,
  driver,
  type Operator,
  operator,
  type Vehicle,
  type VehicleDocument,
  vehicle,
  vehicleDocument,
} from "@/db/schema"
import {
  assessVehicle,
  type ComplianceAssessment,
  type DocumentLike,
  expiryBucket,
} from "@/domain/compliance"

/**
 * The supply side: operators, their vehicles, their drivers, and the documents
 * that decide whether any of it may carry passengers.
 *
 * Compliance is never stored as a derived flag. It is recomputed from the
 * documents every time it is asked for, because the answer changes at
 * midnight without anybody touching the database — an insurance certificate
 * expires on its own.
 */

export type VehicleWithCompliance = Vehicle & {
  documents: VehicleDocument[]
  compliance: ComplianceAssessment
}

export type OperatorDetail = {
  operator: Operator
  vehicles: VehicleWithCompliance[]
  drivers: Driver[]
}

function toDocumentLike(row: VehicleDocument): DocumentLike {
  return { kind: row.kind, expiresOn: row.expiresOn, verification: row.verification }
}

export async function listOperators(): Promise<
  (Operator & { vehicleCount: number; activeVehicleCount: number })[]
> {
  const operators = await db().select().from(operator).orderBy(asc(operator.name))
  if (operators.length === 0) return []

  const vehicles = await db()
    .select()
    .from(vehicle)
    .where(
      inArray(
        vehicle.operatorId,
        operators.map((row) => row.id),
      ),
    )

  return operators.map((row) => {
    const owned = vehicles.filter((entry) => entry.operatorId === row.id)
    return {
      ...row,
      vehicleCount: owned.length,
      activeVehicleCount: owned.filter((entry) => entry.status === "active").length,
    }
  })
}

export async function getOperator(id: string, asOf = new Date()): Promise<OperatorDetail | null> {
  const rows = await db().select().from(operator).where(eq(operator.id, id)).limit(1)
  const found = rows[0]
  if (!found) return null

  const vehicles = await db()
    .select()
    .from(vehicle)
    .where(eq(vehicle.operatorId, id))
    .orderBy(asc(vehicle.registrationNumber))

  const documents =
    vehicles.length === 0
      ? []
      : await db()
          .select()
          .from(vehicleDocument)
          .where(
            inArray(
              vehicleDocument.vehicleId,
              vehicles.map((row) => row.id),
            ),
          )

  const drivers = await db()
    .select()
    .from(driver)
    .where(eq(driver.operatorId, id))
    .orderBy(asc(driver.name))

  return {
    operator: found,
    vehicles: vehicles.map((row) => withCompliance(row, documents, asOf)),
    drivers,
  }
}

function withCompliance(
  row: Vehicle,
  documents: VehicleDocument[],
  asOf: Date,
): VehicleWithCompliance {
  const owned = documents.filter((document) => document.vehicleId === row.id)
  return {
    ...row,
    documents: owned,
    compliance: assessVehicle({
      documents: owned.map(toDocumentLike),
      yearOfManufacture: row.yearOfManufacture,
      asOf,
    }),
  }
}

/** Every vehicle on the platform, judged. The fleet screen and the assignment picker share this. */
export async function listVehicles(
  asOf = new Date(),
): Promise<(VehicleWithCompliance & { operatorName: string })[]> {
  const rows = await db()
    .select({ vehicle, operatorName: operator.name })
    .from(vehicle)
    .innerJoin(operator, eq(vehicle.operatorId, operator.id))
    .orderBy(asc(operator.name), asc(vehicle.registrationNumber))

  if (rows.length === 0) return []

  const documents = await db()
    .select()
    .from(vehicleDocument)
    .where(
      inArray(
        vehicleDocument.vehicleId,
        rows.map((row) => row.vehicle.id),
      ),
    )

  return rows.map((row) => ({
    ...withCompliance(row.vehicle, documents, asOf),
    operatorName: row.operatorName,
  }))
}

/**
 * The verification queue of §4.4 and the expiry ladder of §4.2, in one list.
 *
 * Sorted by how close the consequence is: an expired insurance certificate on
 * an active vehicle is a suspension that should already have happened, and a
 * permit expiring in 29 days is a phone call.
 */
export type ComplianceQueueItem = {
  vehicleId: string
  registrationNumber: string
  operatorId: string
  operatorName: string
  vehicleStatus: Vehicle["status"]
  document: VehicleDocument
  bucket: ReturnType<typeof expiryBucket>
}

const QUEUE_ORDER = ["expired", "missing", "critical", "soon", "watch", "ok"] as const

export async function complianceQueue(asOf = new Date()): Promise<ComplianceQueueItem[]> {
  const rows = await db()
    .select({ document: vehicleDocument, vehicle, operator })
    .from(vehicleDocument)
    .innerJoin(vehicle, eq(vehicleDocument.vehicleId, vehicle.id))
    .innerJoin(operator, eq(vehicle.operatorId, operator.id))

  return rows
    .map((row) => ({
      vehicleId: row.vehicle.id,
      registrationNumber: row.vehicle.registrationNumber,
      operatorId: row.operator.id,
      operatorName: row.operator.name,
      vehicleStatus: row.vehicle.status,
      document: row.document,
      bucket: expiryBucket(row.document.expiresOn, asOf),
    }))
    .filter(
      (item) =>
        item.vehicleStatus !== "retired" &&
        (item.bucket !== "ok" || item.document.verification === "pending"),
    )
    .sort((a, b) => QUEUE_ORDER.indexOf(a.bucket) - QUEUE_ORDER.indexOf(b.bucket))
}

/**
 * Vehicles whose paperwork now blocks them but which are still marked active.
 *
 * §4.2 calls the suspension "hard" and "non-negotiable", so this is what the
 * ops desk acts on — and what the assignment path refuses regardless.
 */
export async function vehiclesNeedingSuspension(asOf = new Date()) {
  const vehicles = await listVehicles(asOf)
  return vehicles.filter((row) => row.status === "active" && !row.compliance.fitForService)
}

export async function suspendVehicle(id: string, reason: string): Promise<void> {
  await db()
    .update(vehicle)
    .set({ status: "suspended", suspensionReason: reason })
    .where(eq(vehicle.id, id))
}

export async function setVehicleStatus(
  id: string,
  status: Vehicle["status"],
  reason: string | null,
): Promise<void> {
  await db().update(vehicle).set({ status, suspensionReason: reason }).where(eq(vehicle.id, id))
}

export async function setDocumentVerification(
  id: string,
  verification: VehicleDocument["verification"],
  notes: string | null,
): Promise<void> {
  await db()
    .update(vehicleDocument)
    .set({ verification, verifiedAt: new Date(), notes })
    .where(eq(vehicleDocument.id, id))
}

/**
 * Records what a government source said about a document.
 *
 * §4.2 wants VAHAN, Sarathi and GSTN checked automatically with manual review
 * only for exceptions. No such integration exists yet — access goes through an
 * authorised aggregator and is a Month-2 item in §14 — so today an ops person
 * checks the portal and records the answer here. The table shape is the one
 * the automated check will write to, so wiring it later changes who calls
 * this, not what it stores.
 */
export async function recordComplianceCheck(input: {
  entityType: "vehicle" | "driver" | "operator"
  entityId: string
  source: "vahan" | "sarathi" | "gstn" | "manual"
  passed: boolean
  result: string
}): Promise<void> {
  await db().insert(complianceCheck).values(input)
}

export async function listComplianceChecks(entityType: string, entityId: string) {
  return db()
    .select()
    .from(complianceCheck)
    .where(and(eq(complianceCheck.entityType, entityType), eq(complianceCheck.entityId, entityId)))
    .orderBy(desc(complianceCheck.checkedAt))
    .limit(20)
}

/** Drivers whose licence lapses inside the window, for the same queue. */
export async function driversWithExpiringLicence(within: Date) {
  return db()
    .select({ driver, operatorName: operator.name })
    .from(driver)
    .innerJoin(operator, eq(driver.operatorId, operator.id))
    .where(
      and(
        isNotNull(driver.dlExpiresOn),
        lte(driver.dlExpiresOn, within.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(asc(driver.dlExpiresOn))
}

export async function createOperator(input: {
  name: string
  city: string
  contactName: string
  phone: string
  email: string | null
  pan: string | null
  gstin: string | null
  commissionBps: number | null
  notes: string | null
}): Promise<Operator> {
  const created = await db().insert(operator).values(input).returning()
  const row = created[0]
  if (!row) throw new Error("operator could not be created")
  return row
}

export async function updateOperator(id: string, values: Partial<Operator>): Promise<void> {
  await db().update(operator).set(values).where(eq(operator.id, id))
}

export async function createVehicle(input: {
  operatorId: string
  registrationNumber: string
  vehicleClass: Vehicle["vehicleClass"]
  seats: number
  ac: boolean
  yearOfManufacture: number
  fuelType: string | null
  features: string[]
  photoCount: number
}): Promise<Vehicle> {
  const created = await db()
    .insert(vehicle)
    .values({ ...input, status: "pending_verification" })
    .returning()

  const row = created[0]
  if (!row) throw new Error("vehicle could not be created")
  return row
}

export async function addDocument(input: {
  vehicleId: string
  kind: VehicleDocument["kind"]
  number: string | null
  issuedOn: string | null
  expiresOn: string | null
}): Promise<void> {
  await db().insert(vehicleDocument).values(input)
}

export async function createDriver(input: {
  operatorId: string
  name: string
  phone: string
  /** Locale codes; defaults to Tamil in the schema when omitted. */
  languages?: string[]
  dlNumber: string | null
  dlExpiresOn: string | null
  policeVerifiedOn: string | null
  medicalCheckedOn: string | null
  inductionTrainedOn: string | null
}): Promise<void> {
  await db().insert(driver).values(input)
}

export async function listDrivers(operatorId: string): Promise<Driver[]> {
  return db()
    .select()
    .from(driver)
    .where(eq(driver.operatorId, operatorId))
    .orderBy(asc(driver.name))
}

export async function listActiveOperators(): Promise<Operator[]> {
  return db()
    .select()
    .from(operator)
    .where(inArray(operator.status, ["active", "pending_verification"]))
    .orderBy(asc(operator.name))
}
