import type { BroadcastSendStatus } from "@/lib/broadcast/types";
import { sendBroadcastBatchAction } from "./actions";

export function broadcastProgressKey(status: BroadcastSendStatus) {
  return `${status.nextCursor}:${status.sentCount}:${status.failedCount}`;
}

export async function runBroadcastLoop(
  initialStatus: BroadcastSendStatus,
  onProgress?: (status: BroadcastSendStatus) => void,
): Promise<BroadcastSendStatus> {
  let currentStatus = initialStatus;
  onProgress?.(currentStatus);

  for (let batch = 0; batch < 10_000; batch += 1) {
    const progressBefore = broadcastProgressKey(currentStatus);

    currentStatus = await sendBroadcastBatchAction({
      broadcastId: currentStatus.broadcastId,
      cursor: currentStatus.nextCursor,
    });
    onProgress?.(currentStatus);

    if (currentStatus.complete) {
      return currentStatus;
    }

    if (broadcastProgressKey(currentStatus) === progressBefore) {
      return currentStatus;
    }
  }

  return currentStatus;
}
