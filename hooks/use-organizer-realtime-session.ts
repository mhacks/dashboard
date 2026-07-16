"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type Organizer = { id: string; email: string };
type SupabaseBrowserClient = ReturnType<typeof createClient>;

export function useOrganizerRealtimeSession(supabase: SupabaseBrowserClient) {
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function syncSession(
      session: Session | null,
      mode: "full" | "refresh",
    ) {
      if (!session?.access_token) {
        await supabase.realtime.setAuth(null);
        if (cancelled) return;
        setOrganizer(null);
        setRealtimeReady(false);
        return;
      }

      if (mode === "refresh") {
        await supabase.realtime.setAuth(session.access_token);
        return;
      }

      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      setOrganizer({
        id: session.user.id,
        email: session.user.email ?? "",
      });
      setRealtimeReady(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        void syncSession(session, "full");
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        void syncSession(session, "refresh");
        return;
      }

      if (event === "SIGNED_OUT") {
        void syncSession(null, "full");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { organizer, realtimeReady };
}
