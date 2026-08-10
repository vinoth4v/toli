"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import {
  addDocument,
  createDriver,
  createOperator,
  createVehicle,
  recordComplianceCheck,
  setDocumentVerification,
  setVehicleStatus,
  updateOperator,
} from "@/data/supply"
import { recordEvent } from "@/db/events"
import { DOCUMENT_KINDS } from "@/domain/compliance"
import { canTransition, VEHICLE_CLASSES, VEHICLE_STATUSES } from "@/domain/vehicle"

/**
 * Operator onboarding and the verification queue — §4.2 and §4.4.
 *
 * Nothing here trusts a photograph of a document. What is stored is a claim
 * plus an expiry date; what makes it a fact is a verification, and a
 * verification records which source said so.
 */

async function actor(): Promise<string | null> {
  const session = await auth()
  return session?.user?.email ?? null
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))

const operatorSchema = z.object({
  name: z.string().trim().min(1),
  city: z.string().trim().min(1),
  contactName: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  email: optionalText,
  pan: optionalText,
  gstin: optionalText,
  commissionPercent: z.string(),
  notes: optionalText,
})

export async function createOperatorAction(formData: FormData): Promise<void> {
  const parsed = operatorSchema.safeParse({
    name: formData.get("name") ?? "",
    city: formData.get("city") ?? "",
    contactName: formData.get("contactName") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    pan: formData.get("pan") ?? "",
    gstin: formData.get("gstin") ?? "",
    commissionPercent: formData.get("commissionPercent") ?? "",
    notes: formData.get("notes") ?? "",
  })

  if (!parsed.success) {
    redirect(`/operators/new?error=${encodeURIComponent("Check the required fields")}`)
  }

  const percent = parsed.data.commissionPercent.trim()
  const operator = await createOperator({
    name: parsed.data.name,
    city: parsed.data.city,
    contactName: parsed.data.contactName,
    phone: parsed.data.phone,
    email: parsed.data.email,
    pan: parsed.data.pan,
    gstin: parsed.data.gstin,
    // Blank means "use the platform rate", which is different from 0%.
    commissionBps: percent === "" ? null : Math.round(Number(percent) * 100),
    notes: parsed.data.notes,
  })

  await recordEvent("operator_created", await actor(), operator.name)
  redirect(`/operators/${operator.id}`)
}

export async function setOperatorStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("operatorId") ?? "")
  const status = String(formData.get("status") ?? "")
  const tier = String(formData.get("tier") ?? "")
  if (!id) return

  await updateOperator(id, {
    ...(status
      ? { status: status as "draft" | "pending_verification" | "active" | "suspended" }
      : {}),
    ...(tier ? { tier: tier as "bronze" | "silver" | "gold" } : {}),
  })

  await recordEvent("operator_created", await actor(), `${id} → ${status || tier}`)
  revalidatePath(`/operators/${id}`)
}

const vehicleSchema = z.object({
  operatorId: z.string().uuid(),
  registrationNumber: z
    .string()
    .trim()
    .min(4)
    .transform((value) => value.toUpperCase().replace(/\s+/g, " ")),
  vehicleClass: z.enum(VEHICLE_CLASSES),
  seats: z.coerce.number().int().min(4).max(90),
  ac: z.coerce.boolean(),
  yearOfManufacture: z.coerce.number().int().min(1990).max(2100),
  fuelType: optionalText,
  features: z.array(z.string()).default([]),
  photoCount: z.coerce.number().int().min(0).max(50),
})

export async function addVehicleAction(formData: FormData): Promise<void> {
  const parsed = vehicleSchema.safeParse({
    operatorId: formData.get("operatorId"),
    registrationNumber: formData.get("registrationNumber") ?? "",
    vehicleClass: formData.get("vehicleClass"),
    seats: formData.get("seats") ?? "0",
    ac: formData.get("ac") === "on",
    yearOfManufacture: formData.get("yearOfManufacture") ?? "0",
    fuelType: formData.get("fuelType") ?? "",
    features: formData.getAll("features").map(String),
    photoCount: formData.get("photoCount") ?? "0",
  })

  if (!parsed.success) return

  const vehicle = await createVehicle(parsed.data)
  await recordEvent("vehicle_created", await actor(), vehicle.registrationNumber)
  revalidatePath(`/operators/${parsed.data.operatorId}`)
}

const documentSchema = z.object({
  vehicleId: z.string().uuid(),
  operatorId: z.string().uuid(),
  kind: z.enum(DOCUMENT_KINDS),
  number: optionalText,
  issuedOn: optionalText,
  expiresOn: optionalText,
})

export async function addDocumentAction(formData: FormData): Promise<void> {
  const parsed = documentSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    operatorId: formData.get("operatorId"),
    kind: formData.get("kind"),
    number: formData.get("number") ?? "",
    issuedOn: formData.get("issuedOn") ?? "",
    expiresOn: formData.get("expiresOn") ?? "",
  })

  if (!parsed.success) return

  await addDocument({
    vehicleId: parsed.data.vehicleId,
    kind: parsed.data.kind,
    number: parsed.data.number,
    issuedOn: parsed.data.issuedOn,
    expiresOn: parsed.data.expiresOn,
  })

  revalidatePath(`/operators/${parsed.data.operatorId}`)
  revalidatePath("/compliance")
}

export async function verifyDocumentAction(formData: FormData): Promise<void> {
  const documentId = String(formData.get("documentId") ?? "")
  const decision = String(formData.get("decision") ?? "")
  const source = String(formData.get("source") ?? "manual")
  const entityId = String(formData.get("vehicleId") ?? "")
  const notes = String(formData.get("notes") ?? "").trim() || null

  if (!documentId || (decision !== "verified" && decision !== "rejected")) return

  await setDocumentVerification(documentId, decision, notes)

  // §4.2 wants the government source's answer beside the document. Until VAHAN
  // and Sarathi access exists (a Month-2 item), an ops person reads the portal
  // and records what it said — into the same table the automated check will use.
  if (entityId) {
    await recordComplianceCheck({
      entityType: "vehicle",
      entityId,
      source: source === "vahan" || source === "sarathi" || source === "gstn" ? source : "manual",
      passed: decision === "verified",
      result: notes ?? `${decision} by ops`,
    })
  }

  await recordEvent("document_verified", await actor(), `${documentId} → ${decision}`)
  revalidatePath("/compliance")
  revalidatePath("/fleet")
}

export async function setVehicleStatusAction(formData: FormData): Promise<void> {
  const vehicleId = String(formData.get("vehicleId") ?? "")
  const from = String(formData.get("from") ?? "")
  const to = String(formData.get("to") ?? "")
  const reason = String(formData.get("reason") ?? "").trim() || null

  if (!vehicleId) return
  const isStatus = (value: string): value is (typeof VEHICLE_STATUSES)[number] =>
    (VEHICLE_STATUSES as readonly string[]).includes(value)

  if (!isStatus(from) || !isStatus(to)) return

  // The state machine of §9 is enforced here, not merely drawn in a document:
  // a suspended vehicle goes back through verification, never straight to active.
  if (!canTransition(from, to)) {
    redirect(
      `/fleet?error=${encodeURIComponent(`A ${from} vehicle cannot become ${to} directly.`)}`,
    )
  }

  await setVehicleStatus(vehicleId, to, to === "suspended" ? reason : null)
  await recordEvent("vehicle_status_changed", await actor(), `${vehicleId}: ${from} → ${to}`)
  revalidatePath("/fleet")
  revalidatePath("/compliance")
}

const driverSchema = z.object({
  operatorId: z.string().uuid(),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  dlNumber: optionalText,
  dlExpiresOn: optionalText,
  policeVerifiedOn: optionalText,
  medicalCheckedOn: optionalText,
  inductionTrainedOn: optionalText,
})

export async function addDriverAction(formData: FormData): Promise<void> {
  const parsed = driverSchema.safeParse({
    operatorId: formData.get("operatorId"),
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    dlNumber: formData.get("dlNumber") ?? "",
    dlExpiresOn: formData.get("dlExpiresOn") ?? "",
    policeVerifiedOn: formData.get("policeVerifiedOn") ?? "",
    medicalCheckedOn: formData.get("medicalCheckedOn") ?? "",
    inductionTrainedOn: formData.get("inductionTrainedOn") ?? "",
  })

  if (!parsed.success) return

  await createDriver(parsed.data)
  await recordEvent("driver_created", await actor(), parsed.data.name)
  revalidatePath(`/operators/${parsed.data.operatorId}`)
}
