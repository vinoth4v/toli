"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { updateSettings } from "@/data/settings"
import { recordEvent } from "@/db/events"
import { GST_TREATMENT_KEYS } from "@/domain/gst"
import { STATE_NAMES } from "@/domain/india"

const schema = z.object({
  defaultCommissionPercent: z.coerce.number().min(0).max(30),
  tcsPercent: z.coerce.number().min(0).max(10),
  tdsPercent: z.coerce.number().min(0).max(10),
  advancePercent: z.coerce.number().min(0).max(100),
  defaultGstTreatment: z.enum(GST_TREATMENT_KEYS as [string, ...string[]]),
  homeState: z.enum(STATE_NAMES as [string, ...string[]]),
  quoteValidityHours: z.coerce.number().int().min(1).max(240),
})

export async function updateSettingsAction(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    defaultCommissionPercent: formData.get("defaultCommissionPercent"),
    tcsPercent: formData.get("tcsPercent"),
    tdsPercent: formData.get("tdsPercent"),
    advancePercent: formData.get("advancePercent"),
    defaultGstTreatment: formData.get("defaultGstTreatment"),
    homeState: formData.get("homeState"),
    quoteValidityHours: formData.get("quoteValidityHours"),
  })

  if (!parsed.success) return

  await updateSettings({
    // Percentages are entered as people speak them and stored as basis points,
    // so nothing downstream ever multiplies by a float.
    defaultCommissionBps: Math.round(parsed.data.defaultCommissionPercent * 100),
    tcsBps: Math.round(parsed.data.tcsPercent * 100),
    tdsBps: Math.round(parsed.data.tdsPercent * 100),
    advanceBps: Math.round(parsed.data.advancePercent * 100),
    defaultGstTreatment: parsed.data.defaultGstTreatment as
      | "passenger_transport_5"
      | "passenger_transport_12"
      | "rental_with_operator_18",
    homeState: parsed.data.homeState,
    quoteValidityHours: parsed.data.quoteValidityHours,
  })

  const session = await auth()
  await recordEvent(
    "settings_updated",
    session?.user?.email ?? null,
    `commission ${parsed.data.defaultCommissionPercent}%, GST ${parsed.data.defaultGstTreatment}`,
  )

  revalidatePath("/console/settings")
}
