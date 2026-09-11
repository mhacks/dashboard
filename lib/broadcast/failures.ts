import type { BroadcastDeliveryDetails } from "@/lib/broadcast/log-types";
import { broadcastDeliveryProgress } from "@/lib/broadcast/progress";
import type { BroadcastFailure } from "@/lib/broadcast/types";

type BroadcastFailureLog = {
  status: string;
  recipients: string[];
  deliveredTo: string[];
  omittedTo: string[];
  failedCount: number;
  recentFailures: BroadcastFailure[];
};

function listBroadcastFailures(
  recipients: string[],
  deliveredTo: string[],
  recordedFailures: BroadcastFailure[],
): BroadcastFailure[] {
  const deliveredSet = new Set(deliveredTo);
  const failureByRecipient = new Map(
    recordedFailures.map((failure) => [failure.recipient, failure.error]),
  );

  return recipients
    .filter((recipient) => !deliveredSet.has(recipient))
    .map((recipient) => ({
      recipient,
      error: failureByRecipient.get(recipient) ?? "Delivery failed",
    }));
}

export function categorizeBroadcastDeliveryFailures(
  log: Pick<
    BroadcastFailureLog,
    "status" | "recipients" | "deliveredTo" | "omittedTo" | "recentFailures"
  >,
) {
  const omittedSet = new Set(log.omittedTo);
  const failures =
    log.status === "complete"
      ? listBroadcastFailures(
          log.recipients,
          log.deliveredTo,
          log.recentFailures,
        )
      : log.recentFailures.map((failure) => ({
          recipient: failure.recipient,
          error: failure.error,
        }));
  const retryFailures: BroadcastFailure[] = [];
  const omittedFailures: BroadcastFailure[] = [];

  for (const failure of failures) {
    if (omittedSet.has(failure.recipient)) {
      omittedFailures.push(failure);
    } else {
      retryFailures.push(failure);
    }
  }

  return { failures, retryFailures, omittedFailures };
}

export function buildBroadcastDeliveryDetails(
  log: Pick<
    BroadcastFailureLog,
    | "status"
    | "recipients"
    | "deliveredTo"
    | "omittedTo"
    | "failedCount"
    | "recentFailures"
  >,
): BroadcastDeliveryDetails {
  const { totalRecipients, sentCount, failedCount, pendingCount } =
    broadcastDeliveryProgress(log);
  const { failures, retryFailures, omittedFailures } =
    categorizeBroadcastDeliveryFailures(log);

  return {
    status: log.status,
    totalRecipients,
    sentCount,
    failedCount,
    pendingCount,
    deliveredTo: log.deliveredTo,
    omittedTo: log.omittedTo,
    failures,
    retryFailures,
    omittedFailures,
  };
}

export function mergeRetryResultsIntoOriginal(
  original: Pick<
    BroadcastFailureLog,
    "recipients" | "deliveredTo" | "recentFailures"
  >,
  retry: Pick<
    BroadcastFailureLog,
    "recipients" | "deliveredTo" | "recentFailures"
  >,
) {
  const deliveredTo = [
    ...new Set([...original.deliveredTo, ...retry.deliveredTo]),
  ];
  const recentFailuresByRecipient = new Map(
    original.recentFailures.map((failure) => [
      failure.recipient,
      failure.error,
    ]),
  );

  for (const failure of retry.recentFailures) {
    recentFailuresByRecipient.set(failure.recipient, failure.error);
  }

  for (const recipient of retry.deliveredTo) {
    recentFailuresByRecipient.delete(recipient);
  }

  const recentFailures = Array.from(recentFailuresByRecipient.entries()).map(
    ([recipient, error]) => ({
      recipient,
      error,
    }),
  );
  const failedCount = listBroadcastFailures(
    original.recipients,
    deliveredTo,
    recentFailures,
  ).length;

  return { deliveredTo, recentFailures, failedCount };
}

export function countRemainingFailures(
  log: Pick<
    BroadcastFailureLog,
    "status" | "recipients" | "deliveredTo" | "omittedTo" | "failedCount"
  >,
) {
  if (log.status !== "complete" || log.failedCount === 0) {
    return log.failedCount;
  }

  const delivered = new Set(log.deliveredTo);
  const omitted = new Set(log.omittedTo);
  let remaining = 0;

  for (const recipient of log.recipients) {
    if (!delivered.has(recipient) && !omitted.has(recipient)) {
      remaining += 1;
    }
  }

  return remaining;
}
