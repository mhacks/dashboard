"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthStateSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/live")) {
      return;
    }

    const supabase = createClient();
    let prevUserId: string | null | undefined = undefined;

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      const userId = session?.user?.id ?? null;
      if (prevUserId === undefined) {
        prevUserId = userId;
        return;
      }
      if (userId !== prevUserId) {
        prevUserId = userId;
        router.refresh();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
