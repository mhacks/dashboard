import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the user's session on every request and keeps the auth cookies in
// sync between the browser and the server. Called from the root proxy.ts.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
  });

  // IMPORTANT: Do not run code between createServerClient and getClaims(). A
  // simple mistake could make it very hard to debug issues with users being
  // randomly logged out. getClaims() also refreshes the auth token.
  await supabase.auth.getClaims();

  // IMPORTANT: You *must* return the supabaseResponse object as-is. If you need
  // to create a new response (e.g. to redirect), copy over its cookies:
  //   const myResponse = NextResponse.redirect(url)
  //   myResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  //   return myResponse
  return supabaseResponse;
}
