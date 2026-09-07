import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (function name `proxy`).
// Do NOT export `runtime` here — Proxy is Node.js-only and setting it throws
// at build time.

const AUTH_ONLY_PAGES = ["/login", "/forgot-password"];
// /reset-password is reached via a recovery link that DOES sign the visitor
// in (see src/app/auth/confirm/route.ts). It must stay reachable while
// authenticated, so it is deliberately excluded from AUTH_ONLY_PAGES even
// though it lives in the same route group.

function isAuthOnlyPage(pathname: string): boolean {
  return AUTH_ONLY_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicPath(pathname: string): boolean {
  return (
    isAuthOnlyPage(pathname) ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/") ||
    pathname.startsWith("/auth/")
  );
}

/** Copy rotated cookies + Supabase's no-store cache headers onto another response. */
function carryOver(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(key);
    if (value) to.headers.set(key, value);
  }
  return to;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Machine endpoints authenticate themselves with a bearer secret and must
  // never be redirected to /login — the cron and callback both depend on
  // reaching their handler even with zero Supabase cookies present.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  // This variable IS the response that must ultimately be returned (or have
  // its cookies/headers carried onto a redirect). Constructing a fresh
  // NextResponse instead of returning this object is the classic way to
  // silently drop a rotated refresh token and break sessions after ~1 hour.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // Do not add logic between createServerClient and getUser(): getUser() is
  // what triggers the refresh, which is what triggers setAll() above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return carryOver(supabaseResponse, NextResponse.redirect(url));
  }

  if (user && isAuthOnlyPage(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return carryOver(supabaseResponse, NextResponse.redirect(url));
  }

  if (user) {
    supabaseResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
