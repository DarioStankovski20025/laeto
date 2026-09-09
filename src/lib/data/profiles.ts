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

/** Every team member — shared-workspace attribution and the Settings "Team" list. */
export async function listTeamMembers(db: DB): Promise<Profile[]> {
  const { data, error } = await db.from("profiles").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
