import "server-only";
import { ScraperError } from "./errors";

export interface ScraperConfig {
  endpoint: string;
  secret: string;
  timeoutMs: number;
}

/**
 * Reads process.env at CALL TIME, never at module scope. A top-level
 * `.parse(process.env)` here would make `next build` fail on any CI runner
 * without production secrets, because building a route imports its whole
 * module graph.
 *
 * MANUAL_CHECK_URL/SECRET are used ONLY for the manual, single-product
 * "Check now" push — the full-catalog case is pull-only now (the report
 * service calls GET /api/reports/feed itself), so there is nothing to push
 * to for that case and no config for it here.
 */
export function getScraperConfig(): ScraperConfig {
  const missing: string[] = [];
  const endpoint = process.env.MANUAL_CHECK_URL;
  const secret = process.env.MANUAL_CHECK_SECRET;

  if (!endpoint) missing.push("MANUAL_CHECK_URL");
  if (!secret) missing.push("MANUAL_CHECK_SECRET");

  if (missing.length > 0) {
    throw new ScraperError("not_configured", `Manual check is not configured. Missing: ${missing.join(", ")}`, {
      missingEnv: missing,
    });
  }

  if (process.env.NODE_ENV === "production" && !endpoint!.startsWith("https://")) {
    throw new ScraperError("not_configured", "MANUAL_CHECK_URL must use HTTPS in production.");
  }

  return {
    endpoint: endpoint!,
    secret: secret!,
    timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS ?? 15_000),
  };
}
