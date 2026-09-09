import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReportRunStatus } from "@/lib/types/database";
import type { ScraperAck } from "@/lib/validation/schemas";
import type { Attribution } from "@/lib/data/products";

type DB = SupabaseClient<Database>;
export type ReportRun = Database["public"]["Tables"]["report_runs"]["Row"];

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION;
}

/**
 * Inserts a queued manual run for one product, using the CALLER'S
 * (RLS-enforced) client. requested_by is stamped server-side from
 * auth.uid() by a trigger, never supplied by the caller. Returns
 * 'conflict' when report_runs_one_active_manual_per_product already has an
 * active run for this product (a double-clicked "Check now").
 */
export async function insertManualRun(db: DB, productId: string): Promise<{ id: string } | "conflict"> {
  const { data, error } = await db
    .from("report_runs")
    .insert({ product_id: productId, trigger_type: "manual", status: "queued" })
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error)) return "conflict";
    throw error;
  }
  return data;
}

/**
 * Inserts a queued daily run using the SERVICE-ROLE client (the cron has no
 * user session — requested_by is left null, meaning "no human requester").
 * Returns 'duplicate' when report_runs_one_daily_per_day already holds
 * today's slot for the team.
 */
export async function insertDailyRun(admin: DB): Promise<{ id: string } | "duplicate"> {
  const { data, error } = await admin
    .from("report_runs")
    .insert({ trigger_type: "daily", status: "queued" })
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
  return data;
}

export interface RunListOptions {
  limit?: number;
  productId?: string;
}

export interface ReportRunWithAttribution extends ReportRun {
  product_title: string | null;
  requested_by_profile: Attribution | null;
}

const REQUESTED_BY_SELECT = "requested_by_profile:profiles!report_runs_requested_by_fkey(id, email, full_name)";

export async function listRuns(db: DB, opts: RunListOptions = {}): Promise<ReportRunWithAttribution[]> {
  let query = db
    .from("report_runs")
    .select(`*, products(title), ${REQUESTED_BY_SELECT}`)
    .order("requested_at", { ascending: false })
    .limit(opts.limit ?? 25);

  if (opts.productId) query = query.eq("product_id", opts.productId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { products, ...run } = row as ReportRun & {
      products: { title: string } | null;
      requested_by_profile: Attribution | null;
    };
    return { ...run, product_title: products?.title ?? null };
  });
}

export async function getRunStatuses(db: DB, ids: string[]): Promise<ReportRun[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("report_runs").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function getLatestCompletedRun(db: DB): Promise<ReportRun | null> {
  const { data, error } = await db
    .from("report_runs")
    .select("*")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMostRecentRun(db: DB): Promise<ReportRun | null> {
  const { data, error } = await db
    .from("report_runs")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Records a successful scraper dispatch: sets the row's counts, then moves
 * status queued -> sent via the guarded RPC. Must use the SERVICE-ROLE
 * client — users have no UPDATE policy on report_runs.
 */
export async function markRunDispatched(
  admin: DB,
  runId: string,
  ack: ScraperAck,
  totals: { productsCount: number; competitorsCount: number },
): Promise<void> {
  const { error: countsError } = await admin
    .from("report_runs")
    .update({ products_count: totals.productsCount, competitors_count: totals.competitorsCount })
    .eq("id", runId);
  if (countsError) throw countsError;

  const { error } = await admin.rpc("apply_report_run_callback", {
    p_run_id: runId,
    p_external_job_id: ack.jobId,
    p_status: "sent",
    p_sent_at: ack.queuedAt ?? new Date().toISOString(),
  });
  if (error) throw error;
}

export async function markRunFailed(admin: DB, runId: string, message: string): Promise<void> {
  const { error } = await admin.rpc("apply_report_run_callback", {
    p_run_id: runId,
    p_external_job_id: null,
    p_status: "failed",
    p_error_message: message,
  });
  if (error) throw error;
}

/** Marks a run completed with zero products, so an empty daily send does not retry every hour. */
export async function markRunSkippedNoProducts(admin: DB, runId: string): Promise<void> {
  const { error } = await admin.rpc("apply_report_run_callback", {
    p_run_id: runId,
    p_external_job_id: null,
    p_status: "completed",
    p_result_data: { skipped: "no_eligible_products" },
  });
  if (error) throw error;
}

export interface ApplyCallbackInput {
  reportRunId: string;
  externalJobId: string | null;
  status: Exclude<ReportRunStatus, "queued" | "sent">;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  reportFileUrl?: string | null;
  resultData?: Record<string, unknown> | null;
}

export type ApplyCallbackOutcome =
  | { kind: "applied"; previousStatus: string; currentStatus: string }
  | { kind: "noop"; status: string }
  | { kind: "not_found" }
  | { kind: "job_mismatch" };

export async function applyCallback(admin: DB, input: ApplyCallbackInput): Promise<ApplyCallbackOutcome> {
  const { data, error } = await admin.rpc("apply_report_run_callback", {
    p_run_id: input.reportRunId,
    p_external_job_id: input.externalJobId,
    p_status: input.status,
    p_started_at: input.startedAt ?? null,
    p_completed_at: input.completedAt ?? null,
    p_error_message: input.errorMessage ?? null,
    p_report_file_url: input.reportFileUrl ?? null,
    p_result_data: input.resultData ?? null,
  });

  if (error) {
    if (error.code === "P0002") return { kind: "not_found" };
    if (error.code === "P0001") return { kind: "job_mismatch" };
    throw error;
  }

  const row = data?.[0];
  if (!row) return { kind: "not_found" };
  if (!row.applied) return { kind: "noop", status: row.current_status };
  return { kind: "applied", previousStatus: row.previous_status, currentStatus: row.current_status };
}

export async function expireStaleRuns(admin: DB, maxAgeInterval = "30 minutes"): Promise<number> {
  const { data, error } = await admin.rpc("expire_stale_report_runs", { p_max_age: maxAgeInterval });
  if (error) throw error;
  return data ?? 0;
}
