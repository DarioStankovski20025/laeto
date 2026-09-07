import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { serverEnv } from "@/lib/utils/env";

/**
 * Server Supabase client for use in Server Components and Server Actions.
 *
 * Cookie writes are wrapped in try/catch because `cookies().set()` throws
 * when called during Server Component *rendering* (Next.js docs: "Setting
 * cookies is not supported during Server Component rendering"). That is
 * expected here: `src/proxy.ts` already refreshed the session and wrote the
 * rotated cookies onto the outgoing response for this same request, so a
 * failed write here is a safe no-op — NOT a sign of a real problem, as long
 * as proxy.ts is running on every request (see its matcher).
 *
 * A fresh client is created per call — per the @supabase/ssr docs, a server
 * client must never be shared across requests.
 */
export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(serverEnv.supabaseUrl(), serverEnv.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // See comment above — expected during RSC render.
        }
      },
    },
  });
}
