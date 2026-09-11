export type BroadcastLogsFilter = {
  target?: string;
  search?: string;
};

export function parseBroadcastLogsSearchQuery(searchParams: { q?: string }) {
  return searchParams.q?.trim() ?? "";
}

export function buildBroadcastLogsQuery(q?: string) {
  const params = new URLSearchParams();
  const trimmedQuery = q?.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildBroadcastLogsFilter(
  channelTargetId: string | null,
  searchQuery: string,
): BroadcastLogsFilter {
  const filter: BroadcastLogsFilter = {};

  if (channelTargetId) {
    filter.target = channelTargetId;
  }

  const search = searchQuery.trim();
  if (search) {
    filter.search = search;
  }

  return filter;
}
