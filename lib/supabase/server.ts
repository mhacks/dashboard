import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for use in Server Components, Route Handlers, and Server
// Actions. A new client is created per request because cookies() is request-scoped.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where setting cookies
            // is not allowed. This can be ignored when middleware refreshes the
            // session (see lib/supabase/middleware.ts).
          }
        },
      },
    },
  );
}
