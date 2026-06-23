"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthStateSync() {
  const router = useRouter();

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return;
    }

    const supabase = createClient();
    let hasHandledInitialEvent = false;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!hasHandledInitialEvent) {
        hasHandledInitialEvent = true;
        return;
      }

      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  return null;
}
