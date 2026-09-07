import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Re-authenticates the current request. Uses getUser() (verified against
 * Supabase, not just a decoded cookie) — never getSession(), which trusts an
 * attacker-controllable cookie. Deduped per-request via React's cache().
 *
 * Every Server Action calls this FIRST. The Next.js 16 docs are explicit
 * that a Proxy matcher does not protect Server Actions ("a Proxy matcher
 * that excludes a path will also skip Server Function calls on that path"),
 * so src/proxy.ts is not a substitute for this check.
 */
export const requireUser = cache(async (): Promise<User> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }
  return user;
});

export async function getUserOrNull(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
