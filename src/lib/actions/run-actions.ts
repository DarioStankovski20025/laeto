"use server";

import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { ok, type ActionResult } from "@/lib/utils/result";
import { handleDataError } from "@/lib/utils/pg-error";
import * as reportRunsData from "@/lib/data/report-runs";
import type { ReportRunWithProductTitle } from "@/lib/data/report-runs";

/** Used by the Logs drawer on open and on manual refresh. */
export async function getRecentRunsAction(productId?: string): Promise<ActionResult<ReportRunWithProductTitle[]>> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  try {
    const runs = await reportRunsData.listRuns(supabase, user.id, { limit: 50, productId });
    return ok(runs);
  } catch (error) {
    return handleDataError(error);
  }
}
