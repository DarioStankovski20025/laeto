import "server-only";
import type { ScraperAck } from "@/lib/validation/schemas";
import type { ScraperFeedItem } from "./types";
import { getSiteUrl } from "@/lib/utils/env";

/**
 * The ONLY place SCRAPER_MOCK_MODE is read in the entire codebase. Refuses
 * to engage in production unless explicitly forced, so mock mode can never
 * silently activate on a live deployment.
 */
export function isMockMode(): boolean {
  if (process.env.SCRAPER_MOCK_MODE !== "true") return false;
  if (process.env.NODE_ENV === "production" && process.env.SCRAPER_MOCK_MODE_FORCE_PRODUCTION !== "true") {
    return false;
  }
  return true;
}

export async function mockDispatch(item: ScraperFeedItem): Promise<ScraperAck> {
  await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250));
  return {
    accepted: true,
    jobId: `mock_${crypto.randomUUID()}`,
    queuedAt: new Date().toISOString(),
    estimatedSeconds: 20 + item.competitors.length * 3,
    message: "MOCK MODE — no scraping was performed.",
  };
}

/**
 * Follows up a mocked dispatch with a realistic callback sequence
 * (processing -> completed) a few seconds later, using the REAL
 * SCRAPER_CALLBACK_SECRET, so the polling UI and the callback route's auth
 * path are both genuinely exercised in local development.
 */
export function scheduleMockCallback(runId: string): void {
  const callbackSecret = process.env.SCRAPER_CALLBACK_SECRET;
  if (!callbackSecret) return; // nothing to authenticate the mock callback with

  const callbackUrl = new URL("/api/reports/callback", getSiteUrl()).toString();

  setTimeout(() => {
    void fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${callbackSecret}` },
      body: JSON.stringify({
        reportRunId: runId,
        status: "processing",
        startedAt: new Date().toISOString(),
      }),
    }).catch(() => {
      /* best-effort local dev convenience only */
    });
  }, 2000);

  setTimeout(() => {
    void fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${callbackSecret}` },
      body: JSON.stringify({
        reportRunId: runId,
        status: "completed",
        completedAt: new Date().toISOString(),
        reportFileUrl: "https://example.invalid/mock-report.xlsx",
        resultData: { mock: true, emailSent: true, emailSentAt: new Date().toISOString() },
      }),
    }).catch(() => {
      /* best-effort local dev convenience only */
    });
  }, 5000);
}
