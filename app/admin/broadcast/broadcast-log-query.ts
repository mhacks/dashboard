export function buildBroadcastLogsQuery({ q }: { q?: string }) {
  const params = new URLSearchParams();
  const trimmedQuery = q?.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
