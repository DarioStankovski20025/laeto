import "server-only";
import type { ProductWithCompetitors } from "@/lib/data/products";
import type { ScraperFeedItem } from "./types";

/**
 * Builds the exact link-only payload sent for a manual "Check now". Pure
 * and synchronous — unlike the old rich payload, this needs no image
 * signing or DB access of its own, since it carries nothing but links.
 * Returns null if the product has no Amazon URL of its own yet (required —
 * there is nothing to build a link-only payload from without it).
 */
export function buildManualCheckPayload(product: ProductWithCompetitors, email: string): ScraperFeedItem | null {
  if (!product.amazon_url) return null;
  return {
    our_product: product.amazon_url,
    competitors: product.competitors.map((c) => c.amazon_url),
    email,
  };
}
