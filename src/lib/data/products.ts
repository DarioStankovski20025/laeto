import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { ProductInput } from "@/lib/validation/schemas";

type DB = SupabaseClient<Database>;
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Competitor = Database["public"]["Tables"]["competitors"]["Row"];

export interface Attribution {
  id: string;
  email: string;
  full_name: string | null;
}

export interface ProductListItem extends Product {
  competitor_count: number;
  created_by_profile: Attribution | null;
}

export interface ProductWithCompetitors extends Product {
  competitors: Competitor[];
}

/**
 * Every function below is client-agnostic: it takes the Supabase client as
 * its first argument. The dashboard passes a cookie-authenticated user
 * client; the cron and scraper-payload builder pass the service-role
 * client. This is the shared LAETO catalog — RLS grants any authenticated
 * user full access, so no per-user filtering happens here. created_by is
 * stamped server-side by a database trigger, never supplied by the caller.
 */

const ATTRIBUTION_SELECT = "created_by_profile:profiles!products_created_by_fkey(id, email, full_name)";

export async function listProducts(db: DB): Promise<ProductListItem[]> {
  const { data, error } = await db
    .from("products")
    .select(`*, competitors(count), ${ATTRIBUTION_SELECT}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { competitors, ...rest } = row as Product & {
      competitors: { count: number }[];
      created_by_profile: Attribution | null;
    };
    return { ...rest, competitor_count: competitors?.[0]?.count ?? 0 };
  });
}

export async function getProduct(db: DB, id: string): Promise<ProductWithCompetitors | null> {
  const { data, error } = await db
    .from("products")
    .select("*, competitors(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ProductWithCompetitors | null;
}

/** Products eligible for the daily scrape: notify_enabled with >=1 competitor. */
export async function listNotifiableProductsWithCompetitors(db: DB): Promise<ProductWithCompetitors[]> {
  const { data, error } = await db.from("products").select("*, competitors(*)").eq("notify_enabled", true);
  if (error) throw error;
  return ((data ?? []) as ProductWithCompetitors[]).filter((p) => p.competitors.length > 0);
}

export async function insertProduct(db: DB, input: ProductInput, id?: string): Promise<Product> {
  const { data, error } = await db
    .from("products")
    .insert({
      ...(id ? { id } : {}),
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

export async function updateProduct(db: DB, id: string, input: ProductInput): Promise<Product> {
  const { data, error } = await db
    .from("products")
    .update({
      asin: input.asin,
      title: input.title,
      notify_enabled: input.notifyEnabled,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setProductNotify(db: DB, id: string, notifyEnabled: boolean): Promise<Product> {
  const { data, error } = await db
    .from("products")
    .update({ notify_enabled: notifyEnabled })
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

export async function deleteProduct(db: DB, id: string): Promise<Product | null> {
  const { data, error } = await db.from("products").delete().eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  return data;
}
