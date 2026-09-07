import type { ReportRunStatus } from "@/lib/types/database";

/**
 * Pure TS mirror of the report_run_status_rank() SQL function defined in
 * supabase/migrations/0005_report_runs.sql. The database is the actual
 * source of truth and enforcement point (via apply_report_run_callback) —
 * this mirror exists so the same ordering can be unit-tested and reused in
 * client-side UI logic (e.g. deciding when to stop polling) without a
 * round-trip. Keep the two in sync if the lifecycle ever changes.
 */
export const REPORT_RUN_STATUS_RANK: Record<ReportRunStatus, number> = {
  queued: 0,
  sent: 1,
  processing: 2,
  completed: 3,
  failed: 4,
};

export const TERMINAL_STATUSES: ReportRunStatus[] = ["completed", "failed"];

export function isTerminalStatus(status: ReportRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Mirrors the guard in apply_report_run_callback: only a strictly higher rank may be applied. */
export function canTransition(from: ReportRunStatus, to: ReportRunStatus): boolean {
  return REPORT_RUN_STATUS_RANK[to] > REPORT_RUN_STATUS_RANK[from];
}
