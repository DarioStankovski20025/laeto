import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dispatchScrapeJob } from "@/lib/scraper/client";
import type { ScraperJobPayload } from "@/lib/scraper/types";

const payload: ScraperJobPayload = {
  schemaVersion: 1,
  reportRunId: "run-1",
  triggerType: "manual",
  requestedAt: "2026-01-01T00:00:00Z",
  callbackUrl: "https://app.example.com/api/reports/callback",
  reportSettings: { recipientEmail: "reports@laeto.example", timezone: "UTC" },
  products: [],
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SCRAPER_MOCK_MODE;
  delete process.env.SCRAPER_API_URL;
  delete process.env.SCRAPER_API_SECRET;
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

    const result = await dispatchScrapeJob(payload);

    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
    if (result.ok) expect(result.ack.jobId).toMatch(/^mock_/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a not_configured error when SCRAPER_API_URL/SECRET are missing", async () => {
    const result = await dispatchScrapeJob(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_configured");
  });

  it("returns a rejected error when the scraper responds with a non-2xx status", async () => {
    process.env.SCRAPER_API_URL = "https://scraper.example.com/jobs";
    process.env.SCRAPER_API_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Internal error", { status: 500 })),
    );

    const result = await dispatchScrapeJob(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("rejected");
      expect(result.error.detail?.status).toBe(500);
    }
  });

  it("returns a bad_response error when the scraper returns invalid JSON", async () => {
    process.env.SCRAPER_API_URL = "https://scraper.example.com/jobs";
    process.env.SCRAPER_API_SECRET = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));

    const result = await dispatchScrapeJob(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("bad_response");
  });

  it("returns a bad_response error when the ack fails schema validation", async () => {
    process.env.SCRAPER_API_URL = "https://scraper.example.com/jobs";
    process.env.SCRAPER_API_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 200 })),
    );

    const result = await dispatchScrapeJob(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("bad_response");
  });

  it("classifies a fetch timeout (DOMException 'TimeoutError') as a timeout, not a generic network error", async () => {
    process.env.SCRAPER_API_URL = "https://scraper.example.com/jobs";
    process.env.SCRAPER_API_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError")),
    );

    const result = await dispatchScrapeJob(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("timeout");
  });

  it("classifies a generic network failure as 'network'", async () => {
    process.env.SCRAPER_API_URL = "https://scraper.example.com/jobs";
    process.env.SCRAPER_API_SECRET = "secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const result = await dispatchScrapeJob(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("network");
  });

  it("returns a valid ack on a well-formed 2xx JSON response", async () => {
    process.env.SCRAPER_API_URL = "https://scraper.example.com/jobs";
    process.env.SCRAPER_API_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accepted: true, jobId: "job_abc" }), { status: 200 }),
      ),
    );

    const result = await dispatchScrapeJob(payload);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ack.jobId).toBe("job_abc");
  });
});
