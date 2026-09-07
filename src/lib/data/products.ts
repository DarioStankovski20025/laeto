import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { ProductInput } from "@/lib/validation/schemas";

type DB = SupabaseClient<Database>;
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Competitor = Database["public"]["Tables"]["competitors"]["Row"];

export interface ProductListItem extends Product {
  competitor_count: number;
}

export interface ProductWithCompetitors extends Product {
  competitors: Competitor[];
}

/**
 * Every function below is client-agnostic: it takes the Supabase client as
 * its first argument. The dashboard passes a cookie-authenticated user
 * client (RLS applies); the cron and scraper-payload builder pass the
 * service-role client (RLS bypassed, used only for the daily job). This is
 * what keeps every query written exactly once.
 */

export async function listProducts(db: DB, userId: string): Promise<ProductListItem[]> {
  const { data, error } = await db
    .from("products")
    .select("*, competitors(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { competitors, ...product } = row as Product & { competitors: { count: number }[] };
    return { ...product, competitor_count: competitors?.[0]?.count ?? 0 };
  });
}

export async function getProduct(db: DB, userId: string, id: string): Promise<ProductWithCompetitors | null> {
  const { data, error } = await db
    .from("products")
    .select("*, competitors(*)")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ProductWithCompetitors | null;
}

/** Products eligible for the daily scrape: notify_enabled with >=1 competitor. */
export async function listNotifiableProductsWithCompetitors(
  db: DB,
  userId: string,
): Promise<ProductWithCompetitors[]> {
  const { data, error } = await db
    .from("products")
    .select("*, competitors(*)")
    .eq("user_id", userId)
    .eq("notify_enabled", true);
  if (error) throw error;
  return ((data ?? []) as ProductWithCompetitors[]).filter((p) => p.competitors.length > 0);
}

export async function insertProduct(
  db: DB,
  userId: string,
  input: ProductInput,
  id?: string,
): Promise<Product> {
  const { data, error } = await db
    .from("products")
    .insert({
      ...(id ? { id } : {}),
      user_id: userId,
      asin: input.asin,
      title: input.title,
      notify_enabled: input.notifyEnabled,
      image_path: input.imagePath ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(
  db: DB,
  userId: string,
  id: string,
  input: ProductInput,
): Promise<Product> {
  const { data, error } = await db
    .from("products")
    .update({
      asin: input.asin,
      title: input.title,
      notify_enabled: input.notifyEnabled,
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setProductNotify(db: DB, userId: string, id: string, notifyEnabled: boolean): Promise<Product> {
  const { data, error } = await db
    .from("products")
    .update({ notify_enabled: notifyEnabled })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Returns the product's previous image_path (for storage cleanup) or null. */
export async function setProductImage(db: DB, productId: string, path: string | null): Promise<string | null> {
  const { data, error } = await db.rpc("set_product_image", { p_product_id: productId, p_path: path });
  if (error) throw error;
  return data;
}

export async function deleteProduct(db: DB, userId: string, id: string): Promise<Product | null> {
  const { data, error } = await db
    .from("products")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}
