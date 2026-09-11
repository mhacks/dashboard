import type { BroadcastDeliveryDetails } from "@/lib/broadcast/log-types";
import { broadcastDeliveryProgress } from "@/lib/broadcast/progress";
import type { BroadcastFailure } from "@/lib/broadcast/types";

export type BroadcastDeliveryRecord = {
  recipient: string;
  status: string;
  error: string | null;
  omitted: boolean;
};

function toFailure(delivery: BroadcastDeliveryRecord): BroadcastFailure {
  return {
    recipient: delivery.recipient,
    error: delivery.error ?? "Delivery failed",
  };
}

export function categorizeBroadcastDeliveries(
  logStatus: string,
  deliveries: BroadcastDeliveryRecord[],
) {
  const deliveredTo: string[] = [];
  const omittedTo: string[] = [];
  const recordedFailures: BroadcastFailure[] = [];
  const retryFailures: BroadcastFailure[] = [];
  const omittedFailures: BroadcastFailure[] = [];

  for (const delivery of deliveries) {
    if (delivery.status === "sent") {
      deliveredTo.push(delivery.recipient);
      continue;
    }

    if (delivery.status !== "failed" && logStatus !== "complete") {
      continue;
    }

    const failure = toFailure(delivery);
    recordedFailures.push(failure);

    if (delivery.omitted) {
      omittedTo.push(delivery.recipient);
      omittedFailures.push(failure);
    } else {
      retryFailures.push(failure);
    }
  }

  return {
    deliveredTo,
    omittedTo,
    failures: recordedFailures,
    retryFailures,
    omittedFailures,
  };
}

export function buildBroadcastDeliveryDetails(
  log: {
    status: string;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
  },
  deliveries: BroadcastDeliveryRecord[],
): BroadcastDeliveryDetails {
  const { totalRecipients, sentCount, failedCount, pendingCount } =
    broadcastDeliveryProgress(log);
  const { deliveredTo, omittedTo, failures, retryFailures, omittedFailures } =
    categorizeBroadcastDeliveries(log.status, deliveries);

  return {
    status: log.status,
    totalRecipients,
    sentCount,
    failedCount,
    pendingCount,
    deliveredTo,
    omittedTo,
    failures,
    retryFailures,
    omittedFailures,
  };
}
