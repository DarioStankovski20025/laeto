import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { FolderInput } from "@/lib/validation/schemas";

type DB = SupabaseClient<Database>;
export type Folder = Database["public"]["Tables"]["folders"]["Row"];

/**
 * Folders are a shared, flat, navigation-only grouping — no nesting, and
 * nothing outside the dashboard UI reads them. Like the rest of this
 * workspace they are visible to every authenticated team member; created_by
 * / updated_by are stamped server-side by database triggers.
 */

export async function listFolders(db: DB): Promise<Folder[]> {
  const { data, error } = await db.from("folders").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getFolder(db: DB, id: string): Promise<Folder | null> {
  const { data, error } = await db.from("folders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertFolder(db: DB, input: FolderInput): Promise<Folder> {
  const { data, error } = await db.from("folders").insert({ name: input.name }).select("*").single();
  if (error) throw error;
  return data;
}

export async function renameFolder(db: DB, id: string, input: FolderInput): Promise<Folder> {
  const { data, error } = await db
    .from("folders")
    .update({ name: input.name })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Products inside are returned to the root by `on delete set null` — never deleted. */
export async function deleteFolder(db: DB, id: string): Promise<void> {
  const { error } = await db.from("folders").delete().eq("id", id);
  if (error) throw error;
}
