import type { BroadcastDeliveryDetails } from "@/lib/broadcast/log-types";
import { broadcastDeliveryProgress } from "@/lib/broadcast/progress";
import type { BroadcastFailure } from "@/lib/broadcast/types";

type BroadcastFailureLog = {
  status: string;
  recipients: string[] | null;
  deliveredTo: string[] | null;
  omittedTo: string[] | null;
  failedCount: number;
  recentFailures: BroadcastFailure[] | null;
};

export function listBroadcastFailures(
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

export function splitBroadcastFailures(
  failures: BroadcastFailure[],
  omittedTo: string[],
) {
  const omittedSet = new Set(omittedTo);
  const retryFailures: BroadcastFailure[] = [];
  const omittedFailures: BroadcastFailure[] = [];

  for (const failure of failures) {
    if (omittedSet.has(failure.recipient)) {
      omittedFailures.push(failure);
    } else {
      retryFailures.push(failure);
    }
  }

  return { retryFailures, omittedFailures };
}

export function categorizeBroadcastDeliveryFailures(
  log: Pick<
    BroadcastFailureLog,
    "status" | "recipients" | "deliveredTo" | "omittedTo" | "recentFailures"
  >,
) {
  const deliveredTo = log.deliveredTo ?? [];
  const omittedTo = log.omittedTo ?? [];
  const recipients = log.recipients ?? [];
  const failures =
    log.status === "complete"
      ? listBroadcastFailures(recipients, deliveredTo, log.recentFailures ?? [])
      : (log.recentFailures ?? []).map((failure) => ({
          recipient: failure.recipient,
          error: failure.error,
        }));
  const { retryFailures, omittedFailures } = splitBroadcastFailures(
    failures,
    omittedTo,
  );

  return { failures, retryFailures, omittedFailures };
}

export function getRetryFailuresFromLog(
  log: Pick<
    BroadcastFailureLog,
    "recipients" | "deliveredTo" | "omittedTo" | "recentFailures"
  >,
) {
  return categorizeBroadcastDeliveryFailures({
    ...log,
    status: "complete",
  }).retryFailures;
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
  const deliveredTo = log.deliveredTo ?? [];
  const omittedTo = log.omittedTo ?? [];
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
    deliveredTo,
    omittedTo,
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
    ...new Set([...(original.deliveredTo ?? []), ...(retry.deliveredTo ?? [])]),
  ];
  const recentFailuresByRecipient = new Map(
    (original.recentFailures ?? []).map((failure) => [
      failure.recipient,
      failure.error,
    ]),
  );

  for (const failure of retry.recentFailures ?? []) {
    recentFailuresByRecipient.set(failure.recipient, failure.error);
  }

  for (const recipient of retry.deliveredTo ?? []) {
    recentFailuresByRecipient.delete(recipient);
  }

  const recentFailures = Array.from(recentFailuresByRecipient.entries()).map(
    ([recipient, error]) => ({
      recipient,
      error,
    }),
  );
  const failedCount = listBroadcastFailures(
    original.recipients ?? [],
    deliveredTo,
    recentFailures,
  ).length;

  return { deliveredTo, recentFailures, failedCount };
}

/** Count failures that still need attention in the feed and delivery modal. */
export function countRemainingFailures(log: BroadcastFailureLog) {
  if (log.status !== "complete" || log.failedCount === 0) {
    return log.failedCount;
  }

  return getRetryFailuresFromLog(log).length;
}
