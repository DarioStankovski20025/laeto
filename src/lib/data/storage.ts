import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type DB = SupabaseClient<Database>;

const PRODUCT_IMAGES_BUCKET = "product-images";
export const SIGNED_URL_TTL_SECONDS = 3600;
export const SCRAPER_SIGNED_URL_TTL_SECONDS = 86400;

/**
 * Batch-signs a set of product-image paths in a single Storage call, keyed
 * by path so the caller can look each one up cheaply.
 *
 * The response from createSignedUrls carries a per-item `error` AND both a
 * `signedUrl` and legacy `signedURL` key — matched by `path`, not array
 * index, and any item with an error or a null path/url is skipped so the
 * grid falls back to a placeholder instead of crashing next/image with a
 * null src.
 */
export async function signProductImages(
  db: DB,
  paths: (string | null)[],
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return result;

  const { data, error } = await db.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrls(unique, ttlSeconds);
  if (error || !data) return result;

  for (const item of data) {
    const url = item.signedUrl ?? item.signedURL;
    if (item.path && url && !item.error) {
      result.set(item.path, url);
    }
  }
  return result;
}

export async function signOneProductImage(
  db: DB,
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await db.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeProductImages(db: DB, paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  // Best-effort: a failure here does not block the caller. Orphans left
  // behind are also caught by the deleted_storage_objects GC queue.
  await db.storage.from(PRODUCT_IMAGES_BUCKET).remove(unique);
}

/** Drains the GC queue populated by the products_image_gc trigger. */
export async function drainStorageGcQueue(db: DB, limit = 100): Promise<number> {
  const { data, error } = await db
    .from("deleted_storage_objects")
    .select("id, bucket_id, path")
    .order("enqueued_at", { ascending: true })
    .limit(limit);
  if (error || !data || data.length === 0) return 0;

  const byBucket = new Map<string, string[]>();
  for (const row of data) {
    const list = byBucket.get(row.bucket_id) ?? [];
    list.push(row.path);
    byBucket.set(row.bucket_id, list);
  }

  for (const [bucketId, paths] of byBucket) {
    await db.storage.from(bucketId).remove(paths);
  }

  const ids = data.map((row) => row.id);
  await db.from("deleted_storage_objects").delete().in("id", ids);
  return ids.length;
}
