import "server-only";

/**
 * Server-side environment access. Every getter reads `process.env` at CALL
 * TIME, never at module scope — a top-level `.parse(process.env)` here would
 * make `next build` fail on any CI runner without production secrets, since
 * building a route imports its whole module graph.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  /** Inbound — the external report service presents this to GET /api/reports/feed. */
  reportsFeedSecret: () => required("REPORTS_FEED_SECRET"),
  scraperCallbackSecret: () => required("SCRAPER_CALLBACK_SECRET"),
};

/** The absolute site URL, used to build the callback URL sent to the scraper. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}
