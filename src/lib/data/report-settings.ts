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

/**
 * Report recipients. Falls back to the legacy single report_email when the
 * report_emails column has not been migrated in yet (0017).
 */
export function getReportEmails(settings: ReportSettings | null): string[] {
  if (!settings) return [];
  if (settings.report_emails?.length) return settings.report_emails;
  return settings.report_email ? [settings.report_email] : [];
}

/** The `email` field sent to the report service: every recipient, comma-separated. */
export function formatReportEmails(emails: string[]): string {
  return emails.join(",");
}

export interface UpdateReportSettingsInput {
  companyName?: string | null;
  reportEmails: string[];
  dailyReportsEnabled: boolean;
  timezone: string;
}

export async function updateReportSettings(db: DB, input: UpdateReportSettingsInput): Promise<ReportSettings> {
  const { data, error } = await db
    .from("report_settings")
    .update({
      company_name: input.companyName ?? null,
      report_emails: input.reportEmails,
      report_email: input.reportEmails[0] ?? null,
      daily_reports_enabled: input.dailyReportsEnabled,
      timezone: input.timezone,
    })
    .eq("id", true)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
