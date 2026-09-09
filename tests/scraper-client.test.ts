import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dispatchScrapeJob } from "@/lib/scraper/client";
import type { ScraperFeedItem } from "@/lib/scraper/types";

const item: ScraperFeedItem = {
  our_product: "https://www.amazon.co.uk/dp/B00ABC1234",
  competitors: ["https://www.amazon.co.uk/dp/B00XYZ9999"],
  email: "reports@laeto.example",
};

const RUN_ID = "run-1";
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SCRAPER_MOCK_MODE;
  delete process.env.MANUAL_CHECK_URL;
  delete process.env.MANUAL_CHECK_SECRET;
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("dispatchScrapeJob", () => {
  it("returns a mocked ack when SCRAPER_MOCK_MODE=true, without calling fetch", async () => {
    process.env.SCRAPER_MOCK_MODE = "true";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await dispatchScrapeJob(item, RUN_ID);

    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
    if (result.ok) expect(result.ack.jobId).toMatch(/^mock_/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a not_configured error when MANUAL_CHECK_URL/SECRET are missing", async () => {
    const result = await dispatchScrapeJob(item, RUN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_configured");
  });

  it("returns a rejected error when the report service responds with a non-2xx status", async () => {
    process.env.MANUAL_CHECK_URL = "https://reports.example.com/manual-check";
    process.env.MANUAL_CHECK_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Internal error", { status: 500 })),
    );

    const result = await dispatchScrapeJob(item, RUN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("rejected");
      expect(result.error.detail?.status).toBe(500);
    }
  });

  it("returns a bad_response error when the report service returns invalid JSON", async () => {
    process.env.MANUAL_CHECK_URL = "https://reports.example.com/manual-check";
    process.env.MANUAL_CHECK_SECRET = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));

    const result = await dispatchScrapeJob(item, RUN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("bad_response");
  });

  it("returns a bad_response error when the ack fails schema validation", async () => {
    process.env.MANUAL_CHECK_URL = "https://reports.example.com/manual-check";
    process.env.MANUAL_CHECK_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 200 })),
    );

    const result = await dispatchScrapeJob(item, RUN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("bad_response");
  });

  it("classifies a fetch timeout (DOMException 'TimeoutError') as a timeout, not a generic network error", async () => {
    process.env.MANUAL_CHECK_URL = "https://reports.example.com/manual-check";
    process.env.MANUAL_CHECK_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError")),
    );

    const result = await dispatchScrapeJob(item, RUN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("timeout");
  });

  it("classifies a generic network failure as 'network'", async () => {
    process.env.MANUAL_CHECK_URL = "https://reports.example.com/manual-check";
    process.env.MANUAL_CHECK_SECRET = "secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const result = await dispatchScrapeJob(item, RUN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("network");
  });

  it("returns a valid ack on a well-formed 2xx JSON response, sending the run id as a header", async () => {
    process.env.MANUAL_CHECK_URL = "https://reports.example.com/manual-check";
    process.env.MANUAL_CHECK_SECRET = "secret";
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, jobId: "job_abc" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await dispatchScrapeJob(item, RUN_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ack.jobId).toBe("job_abc");

    const [, init] = fetchSpy.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Report-Run-Id"]).toBe(RUN_ID);
    expect(headers["Authorization"]).toBe("Bearer secret");
    expect(JSON.parse(init.body as string)).toEqual(item);
  });
});
