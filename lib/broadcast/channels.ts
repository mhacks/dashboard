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

export function getBroadcastChannelPath(targetId: string | null) {
  if (!targetId) {
    return "/admin/broadcast";
  }

  return `/admin/broadcast/${targetToChannelSlug(targetId)}`;
}

export function buildBroadcastChannelHref(
  targetId: string | null,
  options?: { logsPage?: number },
) {
  const path = getBroadcastChannelPath(targetId);

  if (!options?.logsPage || options.logsPage <= 1) {
    return path;
  }

  return `${path}?logsPage=${options.logsPage}`;
}
