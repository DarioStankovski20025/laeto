import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { CompetitorInput } from "@/lib/validation/schemas";

type DB = SupabaseClient<Database>;
export type Competitor = Database["public"]["Tables"]["competitors"]["Row"];

export async function listCompetitors(db: DB, userId: string, productId: string): Promise<Competitor[]> {
  const { data, error } = await db
    .from("competitors")
    .select("*")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function countCompetitors(db: DB, productId: string): Promise<number> {
  const { count, error } = await db
    .from("competitors")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if (error) throw error;
  return count ?? 0;
}

export async function insertCompetitor(
  db: DB,
  userId: string,
  productId: string,
  input: CompetitorInput,
): Promise<Competitor> {
  const { data, error } = await db
    .from("competitors")
    .insert({
      user_id: userId,
      product_id: productId,
      asin: input.asin,
      title: input.title,
      amazon_url: input.amazonUrl,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCompetitor(
  db: DB,
  userId: string,
  id: string,
  input: CompetitorInput,
): Promise<Competitor> {
  const { data, error } = await db
    .from("competitors")
    .update({
      asin: input.asin,
      title: input.title,
      amazon_url: input.amazonUrl,
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCompetitor(db: DB, userId: string, id: string): Promise<void> {
  const { error } = await db.from("competitors").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
