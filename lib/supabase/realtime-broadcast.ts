import { createClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;
type RealtimeChannel = ReturnType<SupabaseBrowserClient["channel"]>;

export async function sendPrivateBroadcast(
  channel: RealtimeChannel | null,
  event: string,
  payload: Record<string, unknown>,
) {
  await channel?.send({
    type: "broadcast",
    event,
    payload,
  });
}
