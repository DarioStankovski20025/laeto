import { NextResponse, type NextRequest } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

/** Non-JS fallback for logout (e.g. a plain <a href="/auth/signout">). */
export async function GET(request: NextRequest) {
  const { supabase, applyAuthHeaders } = await createRouteSupabase();
  await supabase.auth.signOut({ scope: "local" });
  return applyAuthHeaders(NextResponse.redirect(new URL("/login", request.nextUrl.origin)));
}
