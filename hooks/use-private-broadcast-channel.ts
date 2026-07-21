"use client";

import { useEffect, useRef } from "react";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { isBenignRealtimeChannelError } from "@/lib/supabase/realtime-errors";

type SupabaseBrowserClient = ReturnType<typeof createClient>;
type RealtimeChannel = ReturnType<SupabaseBrowserClient["channel"]>;

type SyncPayload = { sourceUserId: string };

export function usePrivateBroadcastChannel<
  TSchema extends z.ZodType<SyncPayload>,
>({
  supabase,
  channelName,
  event,
  payloadSchema,
  organizerId,
  realtimeReady,
  channelRef,
  onRemoteMessage,
  logLabel = channelName,
}: {
  supabase: SupabaseBrowserClient;
  channelName: string;
  event: string;
  payloadSchema: TSchema;
  organizerId: string | undefined;
  realtimeReady: boolean;
  channelRef: React.MutableRefObject<RealtimeChannel | null>;
  onRemoteMessage: (payload: z.infer<TSchema>) => void;
  logLabel?: string;
}) {
  const onRemoteMessageRef = useRef(onRemoteMessage);

  useEffect(() => {
    onRemoteMessageRef.current = onRemoteMessage;
  }, [onRemoteMessage]);

  useEffect(() => {
    if (!realtimeReady || !organizerId) return;

    let active = true;
    const channel = supabase.channel(channelName, {
      config: { private: true },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event }, ({ payload }) => {
      const parsed = payloadSchema.safeParse(payload);
      if (!parsed.success) return;
      if (parsed.data.sourceUserId === organizerId) return;
      onRemoteMessageRef.current(parsed.data);
    });

    channel.subscribe((status, err) => {
      if (!active || status !== "CHANNEL_ERROR") return;
      if (isBenignRealtimeChannelError(err)) return;
      console.error(`Unable to subscribe to ${logLabel}:`, err);
    });

    return () => {
      active = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // channelRef is stable for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    channelName,
    event,
    logLabel,
    organizerId,
    payloadSchema,
    realtimeReady,
    supabase,
  ]);
}
