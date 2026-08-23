"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";

export function AuthStateSync() {
  const router = useRouter();

  useEffect(() => {
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
  }, [router]);

  return null;
}
