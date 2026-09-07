import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time bearer token comparison. Used by every route that trusts a
 * shared secret (cron, scraper callback) so a timing side-channel cannot
 * leak the secret one byte at a time.
 */
export function bearerMatches(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const given = Buffer.from(authHeader.slice("Bearer ".length));
  const want = Buffer.from(expectedSecret);
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}
