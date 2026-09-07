import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

/**
 * The landing target for every Supabase auth email link (password recovery,
 * invite, etc). Supabase's default {{ .ConfirmationURL }} template routes
 * through /auth/v1/verify and returns the token in a URL FRAGMENT, which a
 * server can never read — so the email templates in this project must be
 * changed to link here directly with token_hash as a query param (documented
 * in the README). verifyOtp() exchanges that token for a session and sets
 * cookies via the writable route client, then redirects onward.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset-password";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
  }

  const { supabase, applyAuthHeaders } = await createRouteSupabase();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  const destination = error ? new URL("/login?error=expired_link", origin) : new URL(next, origin);
  return applyAuthHeaders(NextResponse.redirect(destination));
}
