"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";

export function AuthStateSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/live" || pathname.startsWith("/live/")) {
      return;
    }

    const supabase = createClient();
    let prevUserId: string | null | undefined = undefined;

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      const userId = session?.user?.id ?? null;
      if (prevUserId === undefined) {
        prevUserId = userId;
        if (userId) {
          posthog.identify(userId);
        }
        return;
      }
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          posthog.identify(userId);
        } else {
          posthog.reset();
        }
        router.refresh();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
