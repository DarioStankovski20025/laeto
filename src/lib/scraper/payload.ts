import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { ProductWithCompetitors } from "@/lib/data/products";
import { signProductImages, SCRAPER_SIGNED_URL_TTL_SECONDS } from "@/lib/data/storage";
import { getSiteUrl } from "@/lib/utils/env";
import { SCRAPER_SCHEMA_VERSION, type ScraperJobPayload, type ScraperTriggerType } from "./types";

type DB = SupabaseClient<Database>;

export interface BuildPayloadInput {
  reportRunId: string;
  triggerType: ScraperTriggerType;
  requestedAt: string;
  recipientEmail: string;
  timezone: string;
  products: ProductWithCompetitors[];
}

/**
 * Builds the exact JSON payload sent to the PHP scraper. Product images are
 * signed with a 24h TTL (long enough for an async job to fetch them well
 * after dispatch) using a single batched createSignedUrls call.
 */
export async function buildScraperPayload(db: DB, input: BuildPayloadInput): Promise<ScraperJobPayload> {
  const signedUrls = await signProductImages(
    db,
    input.products.map((p) => p.image_path),
    SCRAPER_SIGNED_URL_TTL_SECONDS,
  );

  return {
    schemaVersion: SCRAPER_SCHEMA_VERSION,
    reportRunId: input.reportRunId,
    triggerType: input.triggerType,
    requestedAt: input.requestedAt,
    callbackUrl: new URL("/api/reports/callback", getSiteUrl()).toString(),
    reportSettings: {
      recipientEmail: input.recipientEmail,
      timezone: input.timezone,
    },
    products: input.products.map((product) => ({
      id: product.id,
      asin: product.asin,
      title: product.title,
      imageUrl: product.image_path ? (signedUrls.get(product.image_path) ?? null) : null,
      competitors: product.competitors.map((c) => ({
        id: c.id,
        asin: c.asin,
        title: c.title,
        amazonUrl: c.amazon_url,
      })),
    })),
  };
}

export function computeTotals(products: ProductWithCompetitors[]) {
  return {
    productsCount: products.length,
    competitorsCount: products.reduce((n, p) => n + p.competitors.length, 0),
  };
}
