import { describe, it, expect } from "vitest";
import {
  AMAZON_MARKETPLACES,
  DEFAULT_MARKETPLACE,
  buildAmazonUrl,
  isAmazonMarketplace,
  marketplaceFromUrl,
} from "@/lib/utils/amazon";
import { amazonUrlSchema } from "@/lib/validation/schemas";

describe("buildAmazonUrl", () => {
  it("builds a canonical /dp/ link for a marketplace", () => {
    expect(buildAmazonUrl("amazon.co.uk", "B09D8DT9H3")).toBe("https://www.amazon.co.uk/dp/B09D8DT9H3");
  });

  it("uppercases and trims the ASIN", () => {
    expect(buildAmazonUrl("amazon.de", "  b09d8dt9h3 ")).toBe("https://www.amazon.de/dp/B09D8DT9H3");
  });

  it("produces a URL every marketplace's stored value passes amazonUrlSchema", () => {
    for (const { domain } of AMAZON_MARKETPLACES) {
      const url = buildAmazonUrl(domain, "B09D8DT9H3");
      expect(amazonUrlSchema.safeParse(url).success, `${domain} produced ${url}`).toBe(true);
    }
  });
});

describe("marketplaceFromUrl", () => {
  it("round-trips every marketplace in the list", () => {
    for (const { domain } of AMAZON_MARKETPLACES) {
      expect(marketplaceFromUrl(buildAmazonUrl(domain, "B09D8DT9H3"))).toBe(domain);
    }
  });

  it("reads a host with no www. prefix", () => {
    expect(marketplaceFromUrl("https://amazon.de/dp/B09D8DT9H3")).toBe("amazon.de");
  });

  it("ignores query strings on legacy links", () => {
    expect(marketplaceFromUrl("https://www.amazon.co.uk/dp/B09D8DT9H3?th=1")).toBe("amazon.co.uk");
  });

  it("falls back to the default for a null, malformed, or unknown host", () => {
    expect(marketplaceFromUrl(null)).toBe(DEFAULT_MARKETPLACE);
    expect(marketplaceFromUrl("not-a-url")).toBe(DEFAULT_MARKETPLACE);
    expect(marketplaceFromUrl("https://www.ebay.com/itm/123")).toBe(DEFAULT_MARKETPLACE);
  });
});

describe("isAmazonMarketplace", () => {
  it("accepts a listed domain and rejects anything else", () => {
    expect(isAmazonMarketplace("amazon.co.uk")).toBe(true);
    expect(isAmazonMarketplace("amazon.example")).toBe(false);
  });
});
