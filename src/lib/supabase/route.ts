import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import type { Database } from "@/lib/types/database";
import { serverEnv } from "@/lib/utils/env";

export interface RouteSupabase {
  supabase: SupabaseClient<Database>;
  /**
   * Apply the auth cache-control headers Supabase asks us to set alongside a
   * cookie write (the `headers` second argument to `setAll` — see
   * @supabase/ssr's SetAllCookies type). This prevents a CDN or reverse proxy
   * from ever serving one user's session cookie to another. Also defaults to
   * `no-store` when nothing else set a Cache-Control, since every route using
   * this client is a per-user dynamic response.
   */
  applyAuthHeaders: <R extends NextResponse | Response>(res: R) => R;
}

/**
 * Server Supabase client for use in Route Handlers, where cookie writes are
 * always legal (unlike in a Server Component render).
 */
export async function createRouteSupabase(): Promise<RouteSupabase> {
  const cookieStore = await cookies();
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(serverEnv.supabaseUrl(), serverEnv.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  return {
    supabase,
    applyAuthHeaders(res) {
      for (const [key, value] of Object.entries(pendingHeaders)) {
        res.headers.set(key, value);
      }
      if (!res.headers.has("Cache-Control")) {
        res.headers.set("Cache-Control", "no-store");
      }
      return res;
    },
  };
}
