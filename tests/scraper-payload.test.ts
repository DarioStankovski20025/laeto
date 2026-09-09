import { describe, it, expect } from "vitest";
import { buildScraperPayload, computeTotals } from "@/lib/scraper/payload";
import { SCRAPER_SCHEMA_VERSION } from "@/lib/scraper/types";
import type { ProductWithCompetitors } from "@/lib/data/products";

function makeFakeSupabase(signedUrlByPath: Record<string, string>) {
  return {
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({
            path,
            signedUrl: signedUrlByPath[path] ?? null,
            signedURL: signedUrlByPath[path] ?? null,
            error: signedUrlByPath[path] ? null : "not found",
          })),
          error: null,
        }),
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const product: ProductWithCompetitors = {
  id: "prod-1",
  asin: "B00ABC1234",
  title: "LAETO Widget",
  image_path: "prod-1/photo.jpg",
  notify_enabled: true,
  last_checked_at: null,
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
  ],
};

describe("buildScraperPayload", () => {
  it("builds a payload matching the documented external contract shape", async () => {
    const db = makeFakeSupabase({ "prod-1/photo.jpg": "https://signed.example/photo.jpg" });

    const payload = await buildScraperPayload(db, {
      reportRunId: "run-1",
      triggerType: "manual",
      requestedAt: "2026-01-02T10:00:00Z",
      recipientEmail: "reports@laeto.example",
      timezone: "Europe/London",
      products: [product],
    });

    expect(payload.schemaVersion).toBe(SCRAPER_SCHEMA_VERSION);
    expect(payload.reportRunId).toBe("run-1");
    expect(payload.triggerType).toBe("manual");
    expect(payload.requestedAt).toBe("2026-01-02T10:00:00Z");
    expect(payload.callbackUrl).toMatch(/\/api\/reports\/callback$/);
    expect(payload.reportSettings).toEqual({ recipientEmail: "reports@laeto.example", timezone: "Europe/London" });

    expect(payload.products).toHaveLength(1);
    expect(payload.products[0]).toEqual({
      id: "prod-1",
      asin: "B00ABC1234",
      title: "LAETO Widget",
      imageUrl: "https://signed.example/photo.jpg",
      competitors: [
        {
          id: "comp-1",
          asin: "B00XYZ9999",
          title: "Rival Widget",
          amazonUrl: "https://www.amazon.co.uk/dp/B00XYZ9999",
        },
      ],
    });
  });

  it("sets imageUrl to null when the product has no image", async () => {
    const db = makeFakeSupabase({});
    const noImageProduct = { ...product, image_path: null };

    const payload = await buildScraperPayload(db, {
      reportRunId: "run-2",
      triggerType: "daily",
      requestedAt: "2026-01-02T10:00:00Z",
      recipientEmail: "reports@laeto.example",
      timezone: "UTC",
      products: [noImageProduct],
    });

    expect(payload.products[0].imageUrl).toBeNull();
  });

  it("sets imageUrl to null when signing the image URL fails", async () => {
    const db = makeFakeSupabase({}); // no entry for the product's path -> signing "fails"

    const payload = await buildScraperPayload(db, {
      reportRunId: "run-3",
      triggerType: "manual",
      requestedAt: "2026-01-02T10:00:00Z",
      recipientEmail: "reports@laeto.example",
      timezone: "UTC",
      products: [product],
    });

    expect(payload.products[0].imageUrl).toBeNull();
  });
});

describe("computeTotals", () => {
  it("sums products and their competitors across multiple products", () => {
    const productTwo: ProductWithCompetitors = {
      ...product,
      id: "prod-2",
      competitors: [product.competitors[0], { ...product.competitors[0], id: "comp-2" }],
    };

    const totals = computeTotals([product, productTwo]);
    expect(totals.productsCount).toBe(2);
    expect(totals.competitorsCount).toBe(3);
  });

  it("returns zero totals for an empty product list", () => {
    expect(computeTotals([])).toEqual({ productsCount: 0, competitorsCount: 0 });
  });
});
