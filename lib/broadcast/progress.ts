import type { BroadcastSendStatus } from "@/lib/broadcast/types";

export function broadcastDeliveryProgress(log: {
  status: string;
  recipients: string[];
  deliveredTo: string[];
  failedCount: number;
}) {
  const totalRecipients = log.recipients.length;
  const sentCount = log.deliveredTo.length;
  const failedCount = log.failedCount;
  const complete = log.status === "complete";
  const pendingCount = complete
    ? 0
    : Math.max(0, totalRecipients - sentCount - failedCount);

  return { totalRecipients, sentCount, failedCount, pendingCount, complete };
}

export const BROADCAST_PAUSED_NOTICE =
  "Broadcast paused while another send is in progress or the lease is active. Reload this page to resume from the last checkpoint.";

export function formatBroadcastProgress(
  status: Pick<
    BroadcastSendStatus,
    "sentCount" | "failedCount" | "pendingCount"
  >,
  options?: { prefix?: string; separator?: string },
) {
  const summary = [
    `${status.sentCount} sent`,
    `${status.failedCount} failed`,
    `${status.pendingCount} pending`,
  ].join(options?.separator ?? ", ");
  return options?.prefix ? `${options.prefix}: ${summary}` : summary;
}

export function formatBroadcastOutcome(
  sentCount: number,
  failedCount: number,
  options: { finishedLabel: string; successMessage: string },
) {
  if (failedCount > 0) {
    return `${options.finishedLabel} finished with ${sentCount} sent and ${failedCount} failed.`;
  }

  return options.successMessage;
}

export function broadcastProgressPercent(status: BroadcastSendStatus) {
  if (status.totalRecipients === 0) {
    return 0;
  }

  return Math.round(
    ((status.sentCount + status.failedCount) / status.totalRecipients) * 100,
  );
}
