"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/utils/result";
import { handleDataError } from "@/lib/utils/pg-error";
import * as profilesData from "@/lib/data/profiles";
import type { Profile } from "@/lib/data/profiles";

export async function updateSettingsAction(_prev: unknown, formData: FormData): Promise<ActionResult<Profile>> {
  const user = await requireUser();

  const parsed = settingsSchema.safeParse({
    companyName: formData.get("companyName") || null,
    reportEmail: formData.get("reportEmail"),
    dailyReportsEnabled: formData.get("dailyReportsEnabled") === "true",
    preferredReportHour: Number(formData.get("preferredReportHour")),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return fail("validation", "Check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabase();
  try {
    const profile = await profilesData.updateProfile(supabase, user.id, parsed.data);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return ok(profile);
  } catch (error) {
    return handleDataError(error);
  }
}
