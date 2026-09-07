"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser Supabase client. Safe to memoize at module scope here ONLY —
 * one browser tab is one session. Never do this on the server: a shared
 * server-side client would leak session state across concurrent requests.
 */
export function createBrowserSupabase() {
  cached ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
