"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { recordEvent } from "@/db/events"
import { createOperator, createVehicle, setOperatorStatus, setVehicleActive } from "@/db/operators"
import { rupeesToPaise } from "@/domain/money"
import { OPERATOR_STATUSES } from "@/domain/status"
import { PERMIT_TYPES, VEHICLE_CLASSES } from "@/domain/vehicles"

/** Who is acting, for the audit trail. There is only ever one of them. */
async function actor(): Promise<string | null> {
  const session = await auth()
  return session?.user?.email ?? null
}

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That did not look right"
}

const trimmed = z.string().trim()

const operatorSchema = z.object({
  name: trimmed.min(2, "Name the company"),
  city: trimmed.min(2, "Which city do they operate from?"),
  contactName: trimmed.min(2, "Who is the contact?"),
  phone: trimmed.regex(/^[0-9+\s-]{10,15}$/, "That is not a phone number"),
  /**
   * Optional, and checked only when given: an operator with no GSTIN yet is
   * still worth recording — onboarding beats completeness. The format is state
   * code, PAN, entity number, Z, checksum.
   */
  gstin: z.union([
    trimmed.regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, "That is not a GSTIN"),
    z.literal(""),
  ]),
  commissionPercent: z.coerce.number().min(0).max(50),
  notes: trimmed,
})

export async function createOperatorAction(formData: FormData): Promise<void> {
  const parsed = operatorSchema.safeParse({
    name: formData.get("name") ?? "",
    city: formData.get("city") ?? "",
    contactName: formData.get("contactName") ?? "",
    phone: formData.get("phone") ?? "",
    // A GSTIN is upper case by definition; typing it in lower case is not a
    // different number, so it is normalised before it is checked.
    gstin: String(formData.get("gstin") ?? "")
      .trim()
      .toUpperCase(),
    commissionPercent: formData.get("commissionPercent") ?? "0",
    notes: formData.get("notes") ?? "",
  })

  if (!parsed.success) {
    redirect(`/operators?error=${encodeURIComponent(firstMessage(parsed.error))}`)
  }

  const row = await createOperator({
    name: parsed.data.name,
    city: parsed.data.city,
    contactName: parsed.data.contactName,
    phone: parsed.data.phone,
    gstin: parsed.data.gstin || null,
    commissionBps: Math.round(parsed.data.commissionPercent * 100),
    notes: parsed.data.notes || null,
  })

  await recordEvent("operator_created", await actor(), `${parsed.data.name} (${parsed.data.city})`)
  revalidatePath("/operators")

  redirect(row ? `/operators/${row.id}` : "/operators")
}

const statusSchema = z.object({
  operatorId: z.uuid(),
  status: z.enum(OPERATOR_STATUSES),
})

export async function setOperatorStatusAction(formData: FormData): Promise<void> {
  const parsed = statusSchema.safeParse({
    operatorId: formData.get("operatorId"),
    status: formData.get("status"),
  })
  if (!parsed.success) {
    redirect("/operators?error=Unknown+operator")
  }

  await setOperatorStatus(parsed.data.operatorId, parsed.data.status)
  await recordEvent(
    "operator_status_changed",
    await actor(),
    `${parsed.data.operatorId} is now ${parsed.data.status}`,
  )

  revalidatePath("/operators")
  revalidatePath(`/operators/${parsed.data.operatorId}`)
}

const vehicleSchema = z.object({
  operatorId: z.uuid(),
  /**
   * Indian plates read "TN 09 BW 1234". Stored without separators and upper
   * cased, so "tn09bw1234" and "TN-09-BW-1234" cannot both be added as if they
   * were two different vehicles.
   */
  registration: trimmed
    .regex(
      /^[A-Za-z]{2}[\s-]?[0-9]{1,2}[\s-]?[A-Za-z]{0,3}[\s-]?[0-9]{1,4}$/,
      "That is not a registration number",
    )
    .transform((value) => value.replace(/[\s-]/g, "").toUpperCase()),
  class: z.enum(VEHICLE_CLASSES),
  seats: z.coerce.number().int().min(4).max(60),
  model: trimmed,
  ac: z.boolean(),
  permitType: z.enum(PERMIT_TYPES),
  permitExpiry: z.union([z.iso.date(), z.literal("")]),
  perKmRupees: z.coerce.number().min(0).max(500),
})

export async function createVehicleAction(formData: FormData): Promise<void> {
  const operatorId = String(formData.get("operatorId") ?? "")
  const parsed = vehicleSchema.safeParse({
    operatorId,
    registration: formData.get("registration") ?? "",
    class: formData.get("class"),
    seats: formData.get("seats") ?? "0",
    model: formData.get("model") ?? "",
    ac: formData.get("ac") === "on",
    permitType: formData.get("permitType"),
    permitExpiry: formData.get("permitExpiry") ?? "",
    perKmRupees: formData.get("perKmRupees") ?? "0",
  })

  if (!parsed.success) {
    redirect(`/operators/${operatorId}?error=${encodeURIComponent(firstMessage(parsed.error))}`)
  }

  const duplicate = await addVehicle(parsed.data)
  if (duplicate) {
    redirect(`/operators/${operatorId}?error=${encodeURIComponent(duplicate)}`)
  }

  await recordEvent("vehicle_created", await actor(), parsed.data.registration)
  revalidatePath(`/operators/${operatorId}`)
}

/**
 * Insert, returning a message if the plate is already listed.
 *
 * The unique index is the only thing that actually knows, so the duplicate is
 * caught rather than pre-checked — a check-then-insert would still race. The
 * insert is kept out of the action's own try block because `redirect` works by
 * throwing, and a catch around it would swallow the redirect.
 */
async function addVehicle(data: z.infer<typeof vehicleSchema>): Promise<string | null> {
  try {
    await createVehicle({
      operatorId: data.operatorId,
      registration: data.registration,
      class: data.class,
      seats: data.seats,
      model: data.model || null,
      ac: data.ac,
      permitType: data.permitType,
      permitExpiry: data.permitExpiry || null,
      perKmPaise: data.perKmRupees > 0 ? rupeesToPaise(data.perKmRupees) : null,
    })
    return null
  } catch (error) {
    console.error("vehicle insert failed", error)
    return `${data.registration} could not be added — it may already be listed`
  }
}

export async function setVehicleActiveAction(formData: FormData): Promise<void> {
  const vehicleId = z.uuid().safeParse(formData.get("vehicleId"))
  const operatorId = String(formData.get("operatorId") ?? "")
  if (!vehicleId.success) return

  await setVehicleActive(vehicleId.data, formData.get("active") === "true")
  revalidatePath(`/operators/${operatorId}`)
}
