export function sumBroadcastRecipientCounts(
  targets: { recipientCount: number }[],
) {
  return targets.reduce((sum, target) => sum + target.recipientCount, 0);
}
