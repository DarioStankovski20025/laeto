import { describe, it, expect } from "vitest";
import { buildManualCheckPayload } from "@/lib/scraper/payload";
import type { ProductWithCompetitors } from "@/lib/data/products";

const product: ProductWithCompetitors = {
  id: "prod-1",
  asin: "B00ABC1234",
  title: "LAETO Widget",
  amazon_url: "https://www.amazon.co.uk/dp/B00ABC1234",
  image_path: "prod-1/photo.jpg",
  notify_enabled: true,
  last_checked_at: null,
  folder_id: null,
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  competitors: [
    {
      id: "comp-1",
      product_id: "prod-1",
      asin: "B00XYZ9999",
      title: "Rival Widget",
      amazon_url: "https://www.amazon.co.uk/dp/B00XYZ9999",
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "comp-2",
      product_id: "prod-1",
      asin: "B00XYZ8888",
      title: "Another Rival",
      amazon_url: "https://www.amazon.de/dp/B00XYZ8888",
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
};

describe("buildManualCheckPayload", () => {
  it("builds the link-only payload: our_product, competitors, email", () => {
    const payload = buildManualCheckPayload(product, "reports@laeto.example");

    expect(payload).toEqual({
      our_product: "https://www.amazon.co.uk/dp/B00ABC1234",
      competitors: ["https://www.amazon.co.uk/dp/B00XYZ9999", "https://www.amazon.de/dp/B00XYZ8888"],
      email: "reports@laeto.example",
    });
  });

  it("returns null when the product has no Amazon URL of its own", () => {
    const noUrlProduct = { ...product, amazon_url: null };
    expect(buildManualCheckPayload(noUrlProduct, "reports@laeto.example")).toBeNull();
  });

  it("returns an empty competitors array when the product has none", () => {
    const noCompetitors = { ...product, competitors: [] };
    const payload = buildManualCheckPayload(noCompetitors, "reports@laeto.example");
    expect(payload?.competitors).toEqual([]);
  });
});
