import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { ProductInput } from "@/lib/validation/schemas";
import { buildAmazonUrl } from "@/lib/utils/amazon";

type DB = SupabaseClient<Database>;
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Competitor = Database["public"]["Tables"]["competitors"]["Row"];

export interface Attribution {
  id: string;
  email: string;
  full_name: string | null;
}

export interface FolderRef {
  id: string;
  name: string;
}

export interface ProductListItem extends Product {
  competitor_count: number;
  created_by_profile: Attribution | null;
  folder: FolderRef | null;
}

export interface ProductWithCompetitors extends Product {
  competitors: Competitor[];
}

/**
 * Every function below is client-agnostic: it takes the Supabase client as
 * its first argument. The dashboard passes a cookie-authenticated user
 * client; the feed route (GET /api/reports/feed) passes the service-role
 * client. This is the shared LAETO catalog — RLS grants any authenticated
 * user full access, so no per-user filtering happens here. created_by is
 * stamped server-side by a database trigger, never supplied by the caller.
 */

const ATTRIBUTION_SELECT = "created_by_profile:profiles!products_created_by_fkey(id, email, full_name)";

export async function listProducts(db: DB): Promise<ProductListItem[]> {
  const { data, error } = await db
    .from("products")
    .select(`*, competitors(count), ${ATTRIBUTION_SELECT}, folder:folders(id, name)`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { competitors, ...rest } = row as Product & {
      competitors: { count: number }[];
      created_by_profile: Attribution | null;
      folder: FolderRef | null;
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

/**
 * Products eligible for the feed / a manual check: notify_enabled, has an
 * Amazon URL of its own (required for the link-only payload), and has at
 * least one competitor.
 */
export async function listNotifiableProductsWithCompetitors(db: DB): Promise<ProductWithCompetitors[]> {
  const { data, error } = await db
    .from("products")
    .select("*, competitors(*)")
    .eq("notify_enabled", true)
    .not("amazon_url", "is", null);
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
      // Derived here, never accepted from the client, so an ASIN and its link
      // can never disagree.
      amazon_url: buildAmazonUrl(input.marketplace, input.asin),
      notify_enabled: input.notifyEnabled,
      image_path: input.imagePath ?? null,
      folder_id: input.folderId ?? null,
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
      amazon_url: buildAmazonUrl(input.marketplace, input.asin),
      notify_enabled: input.notifyEnabled,
      folder_id: input.folderId ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Moves a product into a folder, or out of every folder when folderId is null. */
export async function setProductFolder(db: DB, id: string, folderId: string | null): Promise<Product> {
  const { data, error } = await db
    .from("products")
    .update({ folder_id: folderId })
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
