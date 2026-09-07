import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type DB = SupabaseClient<Database>;
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function getProfile(db: DB, userId: string): Promise<Profile | null> {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export interface UpdateProfileInput {
  companyName?: string | null;
  reportEmail: string;
  dailyReportsEnabled: boolean;
  preferredReportHour: number;
  timezone: string;
}

export async function updateProfile(db: DB, userId: string, input: UpdateProfileInput) {
  const preferredReportTime = `${String(input.preferredReportHour).padStart(2, "0")}:00:00`;
  const { data, error } = await db
    .from("profiles")
    .update({
      company_name: input.companyName ?? null,
      report_email: input.reportEmail,
      daily_reports_enabled: input.dailyReportsEnabled,
      preferred_report_time: preferredReportTime,
      timezone: input.timezone,
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
