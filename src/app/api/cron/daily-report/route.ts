import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/utils/env";
import { bearerMatches } from "@/lib/utils/timing-safe";
import * as productsData from "@/lib/data/products";
import * as reportRunsData from "@/lib/data/report-runs";
import { drainStorageGcQueue } from "@/lib/data/storage";
import { buildScraperPayload, computeTotals, dispatchScrapeJob } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs hourly (see vercel.json). Each invocation selects only accounts whose
 * LOCAL hour (per their stored IANA timezone) matches their
 * preferred_report_time, so the setting genuinely drives delivery — a
 * once-daily fixed-UTC cron cannot honor a per-account preferred time.
 *
 * Set CRON_MODE=daily to fall back to a once-a-day, every-enabled-account
 * invocation (e.g. on a platform limited to a single daily cron); in that
 * mode the preferred hour is not honored, and the Settings UI disables the
 * hour picker accordingly (see src/app/(dashboard)/settings).
 */
export async function GET(request: NextRequest) {
  if (!bearerMatches(request.headers.get("authorization"), serverEnv.cronSecret())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const mode = process.env.CRON_MODE === "daily" ? "daily" : "hourly";
  const admin = createAdminSupabase();

  const expiredCount = await reportRunsData.expireStaleRuns(admin).catch(() => 0);

  const { data: candidates, error: candidatesError } = await admin.rpc("select_daily_report_candidates", {
    p_mode: mode,
  });

  if (candidatesError) {
    console.error(JSON.stringify({ at: "cron.daily-report", phase: "select_candidates", error: candidatesError.message }));
    return NextResponse.json({ error: "Failed to select candidates." }, { status: 500 });
  }

  const summary = {
    mode,
    expiredStaleRuns: expiredCount,
    candidates: candidates?.length ?? 0,
    sent: 0,
    failed: 0,
    skippedDuplicate: 0,
    skippedNoProducts: 0,
  };

  for (const account of candidates ?? []) {
    const products = await productsData.listNotifiableProductsWithCompetitors(admin, account.user_id);

    const inserted = await reportRunsData.insertDailyRun(admin, account.user_id);
    if (inserted === "duplicate") {
      summary.skippedDuplicate++;
      continue;
    }

    if (products.length === 0) {
      await reportRunsData.markRunSkippedNoProducts(admin, inserted.id);
      summary.skippedNoProducts++;
      continue;
    }

    const requestedAt = new Date().toISOString();
    const payload = await buildScraperPayload(admin, {
      reportRunId: inserted.id,
      triggerType: "daily",
      requestedAt,
      recipientEmail: account.report_email,
      timezone: account.timezone,
      products,
    });

    const dispatch = await dispatchScrapeJob(payload);

    if (!dispatch.ok) {
      await reportRunsData.markRunFailed(admin, inserted.id, dispatch.error.toUserMessage());
      summary.failed++;
      continue;
    }

    await reportRunsData.markRunDispatched(admin, inserted.id, dispatch.ack, computeTotals(products));
    summary.sent++;
  }

  const gcDrained = await drainStorageGcQueue(admin).catch(() => 0);

  console.log(JSON.stringify({ at: "cron.daily-report", ...summary, gcDrained }));

  return NextResponse.json({ ...summary, gcDrained });
}
