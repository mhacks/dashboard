export function targetToChannelSlug(targetId: string) {
  return targetId.replace(/:/g, "-");
}

export function channelSlugToTargetId(channelSlug: string) {
  const separatorIndex = channelSlug.indexOf("-");

  if (separatorIndex === -1) {
    return null;
  }

  return `${channelSlug.slice(0, separatorIndex)}:${channelSlug.slice(
    separatorIndex + 1,
  )}`;
}

export function broadcastChannelLabel(label: string) {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function sumBroadcastRecipientCounts(
  targets: { recipientCount: number }[],
) {
  return targets.reduce((sum, target) => sum + target.recipientCount, 0);
}

export function getBroadcastChannelPath(targetId: string) {
  return `/admin/broadcast/${targetToChannelSlug(targetId)}`;
}
