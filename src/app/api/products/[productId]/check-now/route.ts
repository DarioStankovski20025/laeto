import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { performManualCheck } from "@/lib/services/manual-check";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  unauthenticated: 401,
  unauthorized: 403,
  not_found: 404,
  conflict: 409,
  validation: 422,
  scraper: 502,
  storage: 502,
  unknown: 500,
};

export async function POST(_request: Request, ctx: RouteContext<"/api/products/[productId]/check-now">) {
  const { productId } = await ctx.params;
  const { supabase, applyAuthHeaders } = await createRouteSupabase();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return applyAuthHeaders(NextResponse.json({ error: "Not authenticated." }, { status: 401 }));
  }

  const admin = createAdminSupabase();
  const result = await performManualCheck(supabase, admin, user, productId);

  if (!result.ok) {
    return applyAuthHeaders(
      NextResponse.json(
        { error: result.message, code: result.code },
        { status: STATUS_BY_CODE[result.code] ?? 500 },
      ),
    );
  }

  return applyAuthHeaders(NextResponse.json({ data: result.data }, { status: 202 }));
}
