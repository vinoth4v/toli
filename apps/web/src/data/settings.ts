import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { type PlatformSetting, platformSetting } from "@/db/schema"

/**
 * The one settings row.
 *
 * Commission, TCS, TDS, the GST treatment in force and the advance
 * percentage all live here rather than in code, because §7.4 and §8.3 say
 * every one of them changes once a CA has answered — and a tax rate that
 * needs a deploy is a tax rate that stays wrong for a fortnight.
 */

export const SETTINGS_ID = "default"

export async function getSettings(): Promise<PlatformSetting> {
  const existing = await db()
    .select()
    .from(platformSetting)
    .where(eq(platformSetting.id, SETTINGS_ID))
    .limit(1)

  if (existing[0]) return existing[0]

  // First run. The defaults are the plan's own starting numbers: 10%
  // commission (§7.4's 8–12% band), 1% TCS, 1% TDS, 25% advance.
  await db().insert(platformSetting).values({ id: SETTINGS_ID }).onConflictDoNothing()

  const created = await db()
    .select()
    .from(platformSetting)
    .where(eq(platformSetting.id, SETTINGS_ID))
    .limit(1)

  const row = created[0]
  if (!row) throw new Error("platform_setting could not be created")
  return row
}

export async function updateSettings(values: Partial<PlatformSetting>): Promise<void> {
  await db()
    .update(platformSetting)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(platformSetting.id, SETTINGS_ID))
}

/** An operator's own rate when they have one, the platform default otherwise. */
export function commissionBpsFor(
  settings: PlatformSetting,
  operatorCommissionBps: number | null,
): number {
  return operatorCommissionBps ?? settings.defaultCommissionBps
}
