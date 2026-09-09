import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type DB = SupabaseClient<Database>;
export type ReportSettings = Database["public"]["Tables"]["report_settings"]["Row"];

/**
 * Singleton row: one shared report configuration for the whole team
 * (recipient email, daily on/off, preferred hour, timezone). Seeded once by
 * migration 0011; every authenticated user can read and update it.
 */
export async function getReportSettings(db: DB): Promise<ReportSettings | null> {
  const { data, error } = await db.from("report_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw error;
  return data;
}

export interface UpdateReportSettingsInput {
  companyName?: string | null;
  reportEmail: string;
  dailyReportsEnabled: boolean;
  timezone: string;
}

export async function updateReportSettings(db: DB, input: UpdateReportSettingsInput): Promise<ReportSettings> {
  const { data, error } = await db
    .from("report_settings")
    .update({
      company_name: input.companyName ?? null,
      report_email: input.reportEmail,
      daily_reports_enabled: input.dailyReportsEnabled,
      timezone: input.timezone,
    })
    .eq("id", true)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
