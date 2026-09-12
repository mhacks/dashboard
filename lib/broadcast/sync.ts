import { z } from "zod";
import type { BroadcastSendStatus } from "@/lib/broadcast/types";

export const BROADCAST_SYNC_CHANNEL = "broadcasts:dashboard";
export const BROADCAST_SYNC_EVENT = "broadcast_updated";

export const broadcastSyncPayloadSchema = z.object({
  sourceUserId: z.uuid(),
  broadcastId: z.uuid(),
  target: z.string().min(1),
  status: z.enum(["sending", "complete", "expired"]),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  totalRecipients: z.number().int().nonnegative(),
});

export type BroadcastSyncPayload = z.infer<typeof broadcastSyncPayloadSchema>;

export function broadcastSyncPayloadFromStatus(
  sourceUserId: string,
  status: BroadcastSendStatus,
): BroadcastSyncPayload {
  return {
    sourceUserId,
    broadcastId: status.broadcastId,
    target: status.target,
    status: status.complete ? "complete" : "sending",
    sentCount: status.sentCount,
    failedCount: status.failedCount,
    pendingCount: status.pendingCount,
    totalRecipients: status.totalRecipients,
  };
}
