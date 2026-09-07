import "server-only";
import { getScraperConfig } from "./config";
import { isMockMode, mockDispatch, scheduleMockCallback } from "./mock";
import { ScraperError } from "./errors";
import { scraperAckSchema, type ScraperAck } from "@/lib/validation/schemas";
import type { ScraperJobPayload } from "./types";
import { logScraperEvent } from "./log";

export type DispatchResult =
  | { ok: true; ack: ScraperAck; mocked: boolean; durationMs: number }
  | { ok: false; error: ScraperError; mocked: boolean; durationMs: number };

/**
 * Dispatches a report job to the external PHP scraper. Never throws — every
 * failure mode (not configured, timeout, rejected, network, bad response) is
 * captured in the returned DispatchResult so callers can persist an accurate
 * report_runs failure instead of crashing the request.
 *
 * Not auto-retried: POST is not idempotent on the PHP side. reportRunId lets
 * the scraper itself deduplicate if it chooses to.
 */
export async function dispatchScrapeJob(payload: ScraperJobPayload): Promise<DispatchResult> {
  const started = performance.now();

  if (isMockMode()) {
    const ack = await mockDispatch(payload);
    const durationMs = Math.round(performance.now() - started);
    logScraperEvent({ phase: "dispatch", outcome: "ok", mocked: true, payload, durationMs, jobId: ack.jobId });
    scheduleMockCallback(payload, ack.jobId);
    return { ok: true, ack, mocked: true, durationMs };
  }

  let config;
  try {
    config = getScraperConfig();
  } catch (e) {
    const error = e as ScraperError;
    const durationMs = Math.round(performance.now() - started);
    logScraperEvent({ phase: "config", outcome: "error", mocked: false, payload, durationMs, error });
    return { ok: false, error, mocked: false, durationMs };
  }

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${config.secret}`,
        "X-Laeto-Run-Id": payload.reportRunId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
      redirect: "error",
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new ScraperError("rejected", `Scraper responded with HTTP ${response.status}`, {
        status: response.status,
        bodySnippet: raw.slice(0, 500),
      });
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new ScraperError("bad_response", "Scraper response was not valid JSON", {
        bodySnippet: raw.slice(0, 500),
      });
    }

    const parsed = scraperAckSchema.safeParse(json);
    if (!parsed.success) {
      throw new ScraperError("bad_response", "Scraper acknowledgement failed schema validation", {
        bodySnippet: raw.slice(0, 500),
      });
    }

    const durationMs = Math.round(performance.now() - started);
    logScraperEvent({
      phase: "dispatch",
      outcome: "ok",
      mocked: false,
      payload,
      durationMs,
      jobId: parsed.data.jobId,
    });
    return { ok: true, ack: parsed.data, mocked: false, durationMs };
  } catch (e) {
    const durationMs = Math.round(performance.now() - started);
    const error = toScraperError(e);
    logScraperEvent({ phase: "dispatch", outcome: "error", mocked: false, payload, durationMs, error });
    return { ok: false, error, mocked: false, durationMs };
  }
}

function toScraperError(e: unknown): ScraperError {
  if (e instanceof ScraperError) return e;
  if (e instanceof Error) {
    // AbortSignal.timeout() rejects with a DOMException named 'TimeoutError'.
    // A caller-triggered abort gives 'AbortError'. Checking only 'AbortError'
    // would misclassify every genuine timeout as a generic network failure.
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return new ScraperError("timeout", "Scraper request timed out", { cause: e });
    }
    return new ScraperError("network", e.message || "Network failure calling the scraper", { cause: e });
  }
  return new ScraperError("network", "Unknown failure calling the scraper", { cause: e });
}
