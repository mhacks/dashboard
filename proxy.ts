import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not add any code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Exact match or a real path segment underneath — plain `.startsWith`
  // would also match unintended siblings like `/mcp-evil` or
  // `/loginx` if such a route ever gets added.
  const isPathOrChild = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`);
  const isPublicPath =
    pathname === "/" ||
    isPathOrChild("/login") ||
    // MCP endpoints authenticate via bearer token (withMcpAuth), not cookies —
    // they must return their own 401 + WWW-Authenticate challenge instead of
    // this middleware's HTML redirect, or OAuth discovery can never start.
    isPathOrChild("/mcp") ||
    isPathOrChild("/.well-known") ||
    // /oauth/consent does its own auth check and redirects to /login with the
    // full query string (authorization_id) preserved; this middleware's
    // redirect below only forwards `pathname`, which would drop it.
    isPathOrChild("/oauth/consent") ||
    // Public docs page explaining how to connect an AI agent to the MCP
    // server — needs to be readable before/without logging in.
    isPathOrChild("/how-to-mcp");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach(({ name, value, ...opts }) =>
        redirectResponse.cookies.set(name, value, opts),
      );
    return redirectResponse;
  }

  if (user && isPathOrChild("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach(({ name, value, ...opts }) =>
        redirectResponse.cookies.set(name, value, opts),
      );
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
