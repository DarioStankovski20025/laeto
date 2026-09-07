import "server-only";
import { ScraperError } from "./errors";
import { getSiteUrl } from "@/lib/utils/env";

export interface ScraperConfig {
  endpoint: string;
  secret: string;
  callbackUrl: string;
  timeoutMs: number;
}

/**
 * Reads process.env at CALL TIME, never at module scope. A top-level
 * `.parse(process.env)` here would make `next build` fail on any CI runner
 * without production secrets, because building a route imports its whole
 * module graph.
 */
export function getScraperConfig(): ScraperConfig {
  const missing: string[] = [];
  const endpoint = process.env.SCRAPER_API_URL;
  const secret = process.env.SCRAPER_API_SECRET;

  if (!endpoint) missing.push("SCRAPER_API_URL");
  if (!secret) missing.push("SCRAPER_API_SECRET");

  if (missing.length > 0) {
    throw new ScraperError("not_configured", `Scraper is not configured. Missing: ${missing.join(", ")}`, {
      missingEnv: missing,
    });
  }

  if (process.env.NODE_ENV === "production" && !endpoint!.startsWith("https://")) {
    throw new ScraperError("not_configured", "SCRAPER_API_URL must use HTTPS in production.");
  }

  return {
    endpoint: endpoint!,
    secret: secret!,
    callbackUrl: new URL("/api/reports/callback", getSiteUrl()).toString(),
    timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS ?? 15_000),
  };
}
