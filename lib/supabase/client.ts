import { createBrowserClient } from "@supabase/ssr";

// Supabase client for use in Client Components ("use client").
// Reads the public env vars, which are inlined into the browser bundle.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

export async function ensureRealtimeAuth(
  supabase: ReturnType<typeof createClient>,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(session?.access_token ?? null);
}
