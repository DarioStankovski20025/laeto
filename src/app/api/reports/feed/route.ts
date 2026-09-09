import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/utils/env";
import { bearerMatches } from "@/lib/utils/timing-safe";
import * as productsData from "@/lib/data/products";
import * as reportSettingsData from "@/lib/data/report-settings";
import * as reportRunsData from "@/lib/data/report-runs";

export const dynamic = "force-dynamic";

/**
 * Pull endpoint for the external report service — it calls this on its own
 * schedule (there is no cron in this app anymore) to get the current set of
 * links to scrape. Link-only payload by design: one self-contained object
 * per product, `email` repeated in each entry so the consumer never has to
 * reach outside the array item it's processing.
 *
 * The run id is NOT part of the JSON body (kept link-only) — it travels as
 * the `X-Report-Run-Id` response header, so the report service can still
 * report processing/completed/failed back to POST /api/reports/callback if
 * it wants to, without the body shape changing.
 */
export async function GET(request: NextRequest) {
  if (!bearerMatches(request.headers.get("authorization"), serverEnv.reportsFeedSecret())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminSupabase();

  const settings = await reportSettingsData.getReportSettings(admin);
  const run = await reportRunsData.insertFeedRun(admin);

  if (!settings?.daily_reports_enabled) {
    await reportRunsData.markRunSkipped(admin, run.id, "reports_disabled");
    return NextResponse.json([], { headers: { "X-Report-Run-Id": run.id } });
  }

  const products = await productsData.listNotifiableProductsWithCompetitors(admin);
  const email = settings.report_email ?? "";

  if (products.length === 0) {
    await reportRunsData.markRunSkipped(admin, run.id, "no_eligible_products");
    return NextResponse.json([], { headers: { "X-Report-Run-Id": run.id } });
  }

  await reportRunsData.setRunCounts(admin, run.id, {
    productsCount: products.length,
    competitorsCount: products.reduce((n, p) => n + p.competitors.length, 0),
  });

  const feed = products.map((product) => ({
    our_product: product.amazon_url,
    competitors: product.competitors.map((c) => c.amazon_url),
    email,
  }));

  return NextResponse.json(feed, { headers: { "X-Report-Run-Id": run.id } });
}
