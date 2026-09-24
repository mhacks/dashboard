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
