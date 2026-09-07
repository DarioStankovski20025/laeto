import { describe, it, expect } from "vitest";
import {
  asinSchema,
  amazonUrlSchema,
  emailSchema,
  productSchema,
  competitorSchema,
  scraperCallbackSchema,
  scraperAckSchema,
} from "@/lib/validation/schemas";

describe("asinSchema", () => {
  it("accepts a valid 10-character alphanumeric ASIN", () => {
    const result = asinSchema.safeParse("B00ABC1234");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("B00ABC1234");
  });

  it("uppercases and trims a lowercase/whitespace-padded ASIN", () => {
    const result = asinSchema.safeParse("  b00abc1234  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("B00ABC1234");
  });

  it("rejects an ASIN shorter than 10 characters", () => {
    expect(asinSchema.safeParse("B00ABC123").success).toBe(false);
  });

  it("rejects an ASIN longer than 10 characters", () => {
    expect(asinSchema.safeParse("B00ABC12345").success).toBe(false);
  });

  it("rejects an ASIN with non-alphanumeric characters", () => {
    expect(asinSchema.safeParse("B00-ABC123").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(asinSchema.safeParse("").success).toBe(false);
  });
});

describe("amazonUrlSchema", () => {
  it("accepts a standard amazon.co.uk product URL", () => {
    expect(amazonUrlSchema.safeParse("https://www.amazon.co.uk/dp/B00ABC1234").success).toBe(true);
  });

  it("accepts amazon.<tld> without a www prefix", () => {
    expect(amazonUrlSchema.safeParse("https://amazon.de/dp/B00ABC1234").success).toBe(true);
  });

  it("accepts amazon.com", () => {
    expect(amazonUrlSchema.safeParse("https://www.amazon.com/dp/B00ABC1234").success).toBe(true);
  });

  it("rejects a plain http:// URL (must be https)", () => {
    expect(amazonUrlSchema.safeParse("http://www.amazon.co.uk/dp/B00ABC1234").success).toBe(false);
  });

  it("rejects a non-Amazon domain", () => {
    expect(amazonUrlSchema.safeParse("https://www.notamazon.com/dp/B00ABC1234").success).toBe(false);
  });

  it("rejects a domain that merely contains 'amazon' as a substring", () => {
    expect(amazonUrlSchema.safeParse("https://www.amazon-deals.com/dp/B00ABC1234").success).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(amazonUrlSchema.safeParse("not-a-url").success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("accepts a well-formed email", () => {
    expect(emailSchema.safeParse("reports@laeto.example").success).toBe(true);
  });

  it("rejects a string with no @", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("productSchema", () => {
  it("accepts a minimal valid product", () => {
    const result = productSchema.safeParse({ asin: "B00ABC1234", title: "Test Product", notifyEnabled: true });
    expect(result.success).toBe(true);
  });

  it("rejects a blank title", () => {
    const result = productSchema.safeParse({ asin: "B00ABC1234", title: "", notifyEnabled: true });
    expect(result.success).toBe(false);
  });

  it("rejects a missing ASIN", () => {
    const result = productSchema.safeParse({ title: "Test Product", notifyEnabled: true });
    expect(result.success).toBe(false);
  });
});

describe("competitorSchema", () => {
  const valid = {
    asin: "B00XYZ9876",
    title: "Competitor Product",
    amazonUrl: "https://www.amazon.co.uk/dp/B00XYZ9876",
  };

  it("accepts a fully valid competitor", () => {
    expect(competitorSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid amazonUrl", () => {
    expect(competitorSchema.safeParse({ ...valid, amazonUrl: "https://ebay.com/item/1" }).success).toBe(false);
  });

  it("rejects an invalid asin", () => {
    expect(competitorSchema.safeParse({ ...valid, asin: "TOO-SHORT" }).success).toBe(false);
  });
});

describe("scraperCallbackSchema", () => {
  it("accepts a valid 'processing' callback", () => {
    const result = scraperCallbackSchema.safeParse({
      reportRunId: "123e4567-e89b-12d3-a456-426614174000",
      externalJobId: "job_123",
      status: "processing",
      startedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid 'completed' callback with resultData", () => {
    const result = scraperCallbackSchema.safeParse({
      reportRunId: "123e4567-e89b-12d3-a456-426614174000",
      externalJobId: "job_123",
      status: "completed",
      completedAt: new Date().toISOString(),
      reportFileUrl: "https://example.com/report.xlsx",
      resultData: { productsProcessed: 5, competitorsProcessed: 12 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a callback with status 'queued' (the scraper must never set this)", () => {
    const result = scraperCallbackSchema.safeParse({
      reportRunId: "123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a callback with status 'sent' (set internally, never by the scraper)", () => {
    const result = scraperCallbackSchema.safeParse({
      reportRunId: "123e4567-e89b-12d3-a456-426614174000",
      status: "sent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a callback missing reportRunId", () => {
    const result = scraperCallbackSchema.safeParse({ status: "processing" });
    expect(result.success).toBe(false);
  });

  it("rejects a callback with a malformed reportRunId", () => {
    const result = scraperCallbackSchema.safeParse({ reportRunId: "not-a-uuid", status: "processing" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status value", () => {
    const result = scraperCallbackSchema.safeParse({
      reportRunId: "123e4567-e89b-12d3-a456-426614174000",
      status: "weird_status",
    });
    expect(result.success).toBe(false);
  });
});

describe("scraperAckSchema", () => {
  it("accepts a minimal valid ack", () => {
    expect(scraperAckSchema.safeParse({ accepted: true, jobId: "job_123" }).success).toBe(true);
  });

  it("rejects accepted: false", () => {
    expect(scraperAckSchema.safeParse({ accepted: false, jobId: "job_123" }).success).toBe(false);
  });

  it("rejects a missing jobId", () => {
    expect(scraperAckSchema.safeParse({ accepted: true }).success).toBe(false);
  });
});
