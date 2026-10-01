import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/utils/env";
import { bearerMatches } from "@/lib/utils/timing-safe";
import { scraperCallbackSchema } from "@/lib/validation/schemas";
import { applyCallback } from "@/lib/data/report-runs";

export const dynamic = "force-dynamic";

/**
 * Receives status updates from the external PHP scraper. Every response
 * (success or failure) intentionally reveals as little as possible: a bad
 * secret and an unknown run both return a generic 401/404 with no detail
 * that would help an attacker probe the endpoint.
 */
export async function POST(request: NextRequest) {
  // See the note in reports/feed: a missing secret is an operator problem and
  // must name itself rather than surfacing as an indistinguishable 500.
  let callbackSecret: string;
  try {
    callbackSecret = serverEnv.scraperCallbackSecret();
  } catch {
    console.error(JSON.stringify({ at: "reports.callback", error: "SCRAPER_CALLBACK_SECRET is not set" }));
    return NextResponse.json(
      {
        error: "Callback is not configured.",
        missing: "SCRAPER_CALLBACK_SECRET",
        hint: "Set it in the deployment's environment variables (Production scope) and redeploy.",
      },
      { status: 503 },
    );
  }

  if (!bearerMatches(request.headers.get("authorization"), callbackSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const parsed = scraperCallbackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid callback payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const admin = createAdminSupabase();

  const outcome = await applyCallback(admin, {
    reportRunId: body.reportRunId,
    externalJobId: body.externalJobId ?? null,
    status: body.status,
    startedAt: body.startedAt ?? null,
    completedAt: body.completedAt ?? null,
    errorMessage: body.errorMessage ?? null,
    reportFileUrl: body.reportFileUrl ?? null,
    resultData: body.resultData ?? null,
  });

  switch (outcome.kind) {
    case "not_found":
      return NextResponse.json({ error: "Unknown report run." }, { status: 404 });
    case "job_mismatch":
      return NextResponse.json({ error: "External job ID does not match this run." }, { status: 409 });
    case "noop":
      // Idempotent: a repeated or out-of-order delivery is a success, not an error.
      return NextResponse.json({ applied: false, status: outcome.status }, { status: 200 });
    case "applied":
      return NextResponse.json(
        { applied: true, previousStatus: outcome.previousStatus, currentStatus: outcome.currentStatus },
        { status: 200 },
      );
  }
}
