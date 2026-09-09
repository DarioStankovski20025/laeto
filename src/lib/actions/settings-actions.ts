"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/utils/result";
import { handleDataError } from "@/lib/utils/pg-error";
import * as reportSettingsData from "@/lib/data/report-settings";
import type { ReportSettings } from "@/lib/data/report-settings";

/** Report settings are a single shared row for the whole team. */
export async function updateSettingsAction(_prev: unknown, formData: FormData): Promise<ActionResult<ReportSettings>> {
  await requireUser();

  const parsed = settingsSchema.safeParse({
    companyName: formData.get("companyName") || null,
    reportEmail: formData.get("reportEmail"),
    dailyReportsEnabled: formData.get("dailyReportsEnabled") === "true",
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  try {
    const settings = await reportSettingsData.updateReportSettings(supabase, parsed.data);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return ok(settings);
  } catch (error) {
    return handleDataError(error);
  }
}
