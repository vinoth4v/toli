"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import { operators, vehicles } from "@/db/schema"
import { isVehicleKind } from "@/lib/catalog"
import { checkboxField, intField, optionalField, textField } from "@/lib/form"

/**
 * Supply first. Everything here exists before a single customer requirement
 * does, because a demand-side app with no supply is an expensive way to
 * disappoint people.
 */

export async function createOperatorAction(form: FormData): Promise<void> {
  const name = textField(form, "name")
  const phone = textField(form, "phone")
  const city = textField(form, "city")
  const commissionPercent = intField(form, "commissionPercent")

  if (!name || !phone || !city || commissionPercent === null || commissionPercent > 100) {
    redirect("/operators?error=invalid")
  }

  const [created] = await db()
    .insert(operators)
    .values({
      name,
      phone,
      city,
      contactName: optionalField(form, "contactName"),
      gstin: optionalField(form, "gstin"),
      notes: optionalField(form, "notes"),
      verified: checkboxField(form, "verified"),
      commissionBps: commissionPercent * 100,
    })
    .returning({ id: operators.id })

  await recordEvent("operator_added", name, `${city}, ${commissionPercent}% commission`)

  if (!created) redirect("/operators")
  redirect(`/operators/${created.id}`)
}

export async function setVerifiedAction(form: FormData): Promise<void> {
  const id = textField(form, "operatorId")
  const verified = textField(form, "verified") === "true"
  if (!id) redirect("/operators?error=invalid")

  await db().update(operators).set({ verified }).where(eq(operators.id, id))
  await recordEvent("operator_verified", id, verified ? "verified" : "verification withdrawn")

  revalidatePath("/operators")
  revalidatePath(`/operators/${id}`)
}

export async function addVehicleAction(form: FormData): Promise<void> {
  const operatorId = textField(form, "operatorId")
  const kind = textField(form, "kind")
  const seats = intField(form, "seats")
  const registration = textField(form, "registration")
  const modelYear = intField(form, "modelYear")

  if (!operatorId) redirect("/operators?error=invalid")
  if (!isVehicleKind(kind) || seats === null || seats < 1 || !registration) {
    redirect(`/operators/${operatorId}?error=invalid`)
  }

  await db().insert(vehicles).values({
    operatorId,
    kind,
    seats,
    registration: registration.toUpperCase(),
    modelYear,
    ac: checkboxField(form, "ac"),
  })

  revalidatePath(`/operators/${operatorId}`)
  revalidatePath("/operators")
}

export async function setVehicleActiveAction(form: FormData): Promise<void> {
  const id = textField(form, "vehicleId")
  const operatorId = textField(form, "operatorId")
  const active = textField(form, "active") === "true"
  if (!id || !operatorId) redirect("/operators?error=invalid")

  await db().update(vehicles).set({ active }).where(eq(vehicles.id, id))

  revalidatePath(`/operators/${operatorId}`)
}
