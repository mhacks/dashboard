import type { BroadcastFailure } from "@/lib/broadcast/types";

type RemainingFailureLog = {
  status: string;
  recipients: string[] | null;
  deliveredTo: string[] | null;
  omittedTo: string[] | null;
  failedCount: number;
  recentFailures: BroadcastFailure[] | null;
};

/** Derive failed deliveries with reasons from a completed broadcast log. */
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

/** Count failures that still need attention in the feed and delivery modal. */
export function countRemainingFailures(log: RemainingFailureLog) {
  if (log.status !== "complete" || log.failedCount === 0) {
    return log.failedCount;
  }

  const failures = listBroadcastFailures(
    log.recipients ?? [],
    log.deliveredTo ?? [],
    log.recentFailures ?? [],
  );
  const { retryFailures } = splitBroadcastFailures(
    failures,
    log.omittedTo ?? [],
  );

  return retryFailures.length;
}
