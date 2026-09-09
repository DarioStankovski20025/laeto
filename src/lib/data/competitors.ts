import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { CompetitorInput } from "@/lib/validation/schemas";
import type { Attribution } from "@/lib/data/products";

type DB = SupabaseClient<Database>;
export type Competitor = Database["public"]["Tables"]["competitors"]["Row"];

export interface CompetitorWithAttribution extends Competitor {
  created_by_profile: Attribution | null;
}

const ATTRIBUTION_SELECT = "created_by_profile:profiles!competitors_created_by_fkey(id, email, full_name)";

export async function listCompetitors(db: DB, productId: string): Promise<CompetitorWithAttribution[]> {
  const { data, error } = await db
    .from("competitors")
    .select(`*, ${ATTRIBUTION_SELECT}`)
    .eq("product_id", productId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CompetitorWithAttribution[];
}

export async function countCompetitors(db: DB, productId: string): Promise<number> {
  const { count, error } = await db
    .from("competitors")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if (error) throw error;
  return count ?? 0;
}

export async function insertCompetitor(db: DB, productId: string, input: CompetitorInput): Promise<Competitor> {
  const { data, error } = await db
    .from("competitors")
    .insert({
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

export async function updateCompetitor(db: DB, id: string, input: CompetitorInput): Promise<Competitor> {
  const { data, error } = await db
    .from("competitors")
    .update({
      asin: input.asin,
      title: input.title,
      amazon_url: input.amazonUrl,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCompetitor(db: DB, id: string): Promise<void> {
  const { error } = await db.from("competitors").delete().eq("id", id);
  if (error) throw error;
}
