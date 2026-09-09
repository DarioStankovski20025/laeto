import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { serverEnv } from "@/lib/utils/env";

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * Import this ONLY from:
 *   - src/app/api/reports/feed/route.ts
 *   - src/app/api/reports/callback/route.ts
 *   - src/lib/data/* functions explicitly called by the above
 *
 * NEVER import from a page, layout, component, or a user-triggered Server
 * Action — those must use createServerSupabase()/createRouteSupabase() so
 * RLS enforces per-user ownership. This file has no user session to act on
 * behalf of; every call site is responsible for its own authorization.
 *
 * Not memoized: a fresh client per invocation avoids any shared state
 * surviving across requests on a warm serverless instance.
 */
export function createAdminSupabase(): SupabaseClient<Database> {
  return createClient<Database>(serverEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-Client-Info": "laeto-tracker-admin" },
    },
  });
}
