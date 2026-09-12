"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BROADCAST_SYNC_CHANNEL,
  BROADCAST_SYNC_EVENT,
  broadcastSyncPayloadFromStatus,
  broadcastSyncPayloadSchema,
  type BroadcastSyncPayload,
} from "@/lib/broadcast/sync";
import type { BroadcastSendStatus } from "@/lib/broadcast/types";
import { createClient } from "@/lib/supabase/client";

type Organizer = { id: string; email: string };
type SupabaseBrowserClient = ReturnType<typeof createClient>;
type BroadcastSyncChannel = ReturnType<SupabaseBrowserClient["channel"]>;
type BroadcastSyncListener = (payload: BroadcastSyncPayload) => void;

type BroadcastSyncContextValue = {
  organizerId: string | null;
  activeSendId: string | null;
  setActiveSendId: (broadcastId: string | null) => void;
  publishBroadcastSync: (status: BroadcastSendStatus) => void;
  subscribeBroadcastSync: (listener: BroadcastSyncListener) => () => void;
};

const BroadcastSyncContext = createContext<BroadcastSyncContextValue | null>(
  null,
);

function isBenignRealtimeChannelError(error: unknown) {
  if (!error) return true;

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("socket closed: 1001") ||
    message.includes("socket closed") ||
    message.includes("Channel closed")
  );
}

export function useBroadcastSync() {
  const value = useContext(BroadcastSyncContext);
  if (!value) {
    throw new Error(
      "useBroadcastSync must be used within BroadcastSyncProvider",
    );
  }
  return value;
}

export function BroadcastSyncProvider({ children }: { children: ReactNode }) {
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [activeSendId, setActiveSendId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<BroadcastSyncChannel | null>(null);
  const listenersRef = useRef(new Set<BroadcastSyncListener>());
  const organizerRef = useRef(organizer);
  const publishRef = useRef<(status: BroadcastSendStatus) => void>(() => {});

  useEffect(() => {
    organizerRef.current = organizer;
  }, [organizer]);

  const notifyListeners = useCallback((payload: BroadcastSyncPayload) => {
    for (const listener of listenersRef.current) {
      listener(payload);
    }
  }, []);

  const subscribeBroadcastSync = useCallback(
    (listener: BroadcastSyncListener) => {
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
    [],
  );

  const publishBroadcastSync = useCallback((status: BroadcastSendStatus) => {
    publishRef.current(status);
  }, []);

  useEffect(() => {
    publishRef.current = (status: BroadcastSendStatus) => {
      const sourceUserId = organizerRef.current?.id;
      if (!sourceUserId) {
        return;
      }

      const payload = broadcastSyncPayloadFromStatus(sourceUserId, status);
      notifyListeners(payload);
      void channelRef.current
        ?.send({
          type: "broadcast",
          event: BROADCAST_SYNC_EVENT,
          payload,
        })
        .catch((error) => {
          console.error("Unable to publish broadcast sync:", error);
        });
    };
  }, [notifyListeners]);

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

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (cancelled || error || !user) {
        await supabase.realtime.setAuth(null);
        setOrganizer(null);
        setRealtimeReady(false);
        return;
      }

      if (mode === "refresh") {
        await supabase.realtime.setAuth(session.access_token);
        return;
      }

      setRealtimeReady(false);
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      setOrganizer({ id: user.id, email: user.email ?? "" });
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

  useEffect(() => {
    if (!realtimeReady || !organizer) return;

    let active = true;
    const channel = supabase.channel(BROADCAST_SYNC_CHANNEL, {
      config: { private: true },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: BROADCAST_SYNC_EVENT }, ({ payload }) => {
      const parsed = broadcastSyncPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      if (parsed.data.sourceUserId === organizer.id) return;
      notifyListeners(parsed.data);
    });

    channel.subscribe((status, err) => {
      if (!active || status !== "CHANNEL_ERROR") return;
      if (isBenignRealtimeChannelError(err)) return;
      console.error("Unable to subscribe to broadcast sync channel:", err);
    });

    return () => {
      active = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [notifyListeners, organizer, realtimeReady, supabase]);

  return (
    <BroadcastSyncContext.Provider
      value={{
        organizerId: organizer?.id ?? null,
        activeSendId,
        setActiveSendId,
        publishBroadcastSync,
        subscribeBroadcastSync,
      }}
    >
      {children}
    </BroadcastSyncContext.Provider>
  );
}
