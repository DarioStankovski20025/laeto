import { NextResponse, type NextRequest } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createAdminSupabase } from "@/lib/supabase/admin";
import * as reportRunsData from "@/lib/data/report-runs";

export const dynamic = "force-dynamic";

const MAX_IDS = 25;
const STALE_SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

/** Batched status lookup, polled by the client while a run is active. */
export async function GET(request: NextRequest) {
  const { supabase, applyAuthHeaders } = await createRouteSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return applyAuthHeaders(NextResponse.json({ error: "Not authenticated." }, { status: 401 }));
  }

  const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return applyAuthHeaders(NextResponse.json({ runs: [], next_poll_ms: 15000 }));
  }

  // Opportunistic sweep of runs stuck in queued/sent/processing for too long,
  // so a dead run resolves to `failed` and the client's poll naturally stops.
  const now = Date.now();
  if (now - lastSweepAt > STALE_SWEEP_INTERVAL_MS) {
    lastSweepAt = now;
    try {
      await reportRunsData.expireStaleRuns(createAdminSupabase());
    } catch {
      // Non-critical — the next sweep attempt will retry.
    }
  }

  const runs = await reportRunsData.getRunStatuses(supabase, ids);
  const anyActive = runs.some((r) => r.status === "queued" || r.status === "sent" || r.status === "processing");

  return applyAuthHeaders(
    NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        status: r.status,
        product_id: r.product_id,
        error_message: r.error_message,
        report_file_url: r.report_file_url,
        updated_at: r.updated_at,
      })),
      next_poll_ms: anyActive ? 2000 : 15000,
    }),
  );
}
