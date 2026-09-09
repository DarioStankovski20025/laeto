import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import * as productsData from "@/lib/data/products";
import * as reportRunsData from "@/lib/data/report-runs";
import * as reportSettingsData from "@/lib/data/report-settings";
import { buildScraperPayload, computeTotals, dispatchScrapeJob } from "@/lib/scraper";
import { fail, ok, type ActionResult } from "@/lib/utils/result";
import type { ReportRun } from "@/lib/data/report-runs";

type DB = SupabaseClient<Database>;

export interface ManualCheckResult {
  runId: string;
  status: ReportRun["status"];
  mocked: boolean;
  message?: string;
}

/**
 * The single implementation behind "Check now", shared by the
 * POST /api/products/[productId]/check-now route handler and any future
 * server-side caller. `user` gates AUTHENTICATION only (must be logged in)
 * — the product catalog is a shared team workspace, so there is no
 * per-user ownership check. Takes both a user-scoped client (RLS-enforced
 * insert, stamping requested_by from auth.uid()) and the service-role
 * client (status update after dispatch — users have no UPDATE policy on
 * report_runs).
 */
export async function performManualCheck(
  userClient: DB,
  adminClient: DB,
  user: User,
  productId: string,
): Promise<ActionResult<ManualCheckResult>> {
  const product = await productsData.getProduct(userClient, productId);
  if (!product) return fail("not_found", "Product not found.");
  if (product.competitors.length === 0) {
    return fail("validation", "Add at least one competitor before checking this product's price.");
  }

  const inserted = await reportRunsData.insertManualRun(userClient, productId);
  if (inserted === "conflict") {
    return fail("conflict", "A check is already running for this product.");
  }

  const settings = await reportSettingsData.getReportSettings(userClient);
  const requestedAt = new Date().toISOString();

  const payload = await buildScraperPayload(userClient, {
    reportRunId: inserted.id,
    triggerType: "manual",
    requestedAt,
    recipientEmail: settings?.report_email ?? user.email ?? "",
    timezone: settings?.timezone ?? "UTC",
    products: [product],
  });

  const dispatch = await dispatchScrapeJob(payload);

  if (!dispatch.ok) {
    await reportRunsData.markRunFailed(adminClient, inserted.id, dispatch.error.toUserMessage());
    return fail("scraper", dispatch.error.toUserMessage());
  }

  const totals = computeTotals([product]);
  await reportRunsData.markRunDispatched(adminClient, inserted.id, dispatch.ack, totals);

  return ok({
    runId: inserted.id,
    status: "sent",
    mocked: dispatch.mocked,
    message: dispatch.ack.message ?? undefined,
  });
}
