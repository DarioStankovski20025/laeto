import "server-only";
import type { ScraperFeedItem } from "./types";
import type { ScraperError } from "./errors";

const SECRET_ENV_KEYS = [
  "MANUAL_CHECK_SECRET",
  "SCRAPER_CALLBACK_SECRET",
  "REPORTS_FEED_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function redact(input: string): string {
  let out = input;
  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.length > 6) out = out.split(value).join("***REDACTED***");
  }
  return out
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer ***")
    .replace(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@/g, "$1***@")
    .replace(/(token|signature|X-Amz-Signature)=[^&\s"']+/gi, "$1=***");
}

interface ScraperLogEvent {
  phase: "config" | "dispatch";
  outcome: "ok" | "error";
  mocked: boolean;
  item: ScraperFeedItem;
  durationMs: number;
  jobId?: string;
  error?: ScraperError;
}

/** One redacted JSON line per dispatch attempt. Never logs the recipient
 * email unmasked or any Authorization header. */
export function logScraperEvent(event: ScraperLogEvent): void {
  const line = {
    at: new Date().toISOString(),
    phase: event.phase,
    outcome: event.outcome,
    mocked: event.mocked,
    competitorsCount: event.item.competitors.length,
    durationMs: event.durationMs,
    jobId: event.jobId,
    errorCode: event.error?.code,
    errorMessage: event.error ? redact(event.error.message) : undefined,
    bodySnippet: event.error?.detail?.bodySnippet ? redact(event.error.detail.bodySnippet) : undefined,
  };
  console.log(JSON.stringify(line));
}
