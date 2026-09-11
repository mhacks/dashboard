import type { BroadcastDeliveryDetails } from "@/lib/broadcast/log-types";
import { broadcastDeliveryProgress } from "@/lib/broadcast/progress";
import type { BroadcastFailure } from "@/lib/broadcast/types";
import type { BroadcastDeliveryRow } from "@/lib/db/schema/broadcasts";

export type BroadcastDeliveryRecord = Pick<
  BroadcastDeliveryRow,
  "recipient" | "status" | "error" | "omitted"
>;

export function categorizeBroadcastDeliveries(
  logStatus: string,
  deliveries: BroadcastDeliveryRecord[],
) {
  const deliveredTo: string[] = [];
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

    const failure = {
      recipient: delivery.recipient,
      error: delivery.error ?? "Delivery failed",
    };

    if (delivery.omitted) {
      omittedFailures.push(failure);
    } else {
      retryFailures.push(failure);
    }
  }

  return { deliveredTo, retryFailures, omittedFailures };
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
  const { deliveredTo, retryFailures, omittedFailures } =
    categorizeBroadcastDeliveries(log.status, deliveries);

  return {
    status: log.status,
    totalRecipients,
    sentCount,
    failedCount,
    pendingCount,
    deliveredTo,
    retryFailures,
    omittedFailures,
  };
}
