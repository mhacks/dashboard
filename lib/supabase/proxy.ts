import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { destinationForRole } from "@/lib/auth/redirects";
import { getSessionUser } from "@/lib/auth/session";

function redirectWithSessionCookies(
  url: URL | string,
  supabaseResponse: NextResponse,
) {
  const redirectResponse = NextResponse.redirect(url);
  supabaseResponse.cookies
    .getAll()
    .forEach(({ name, value, ...opts }) =>
      redirectResponse.cookies.set(name, value, opts),
    );
  supabaseResponse.headers.forEach((value, key) => {
    redirectResponse.headers.set(key, value);
  });
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  //
  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;
  const { pathname } = request.nextUrl;
  const isPublicPath = pathname === "/" || pathname.startsWith("/login");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return redirectWithSessionCookies(url, supabaseResponse);
  }

  if (user && pathname.startsWith("/login")) {
    const next = request.nextUrl.searchParams.get("next");
    const sessionUser = await getSessionUser();
    const destination = destinationForRole(sessionUser?.role ?? "hacker", next);
    return redirectWithSessionCookies(
      new URL(destination, request.url),
      supabaseResponse,
    );
  }

  if (user && pathname.startsWith("/admin")) {
    const sessionUser = await getSessionUser();
    if (sessionUser?.role !== "organizer") {
      return redirectWithSessionCookies(
        new URL("/apply", request.url),
        supabaseResponse,
      );
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!
  return supabaseResponse;
}
