import type { BroadcastFailure } from "@/lib/broadcast/types";

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
