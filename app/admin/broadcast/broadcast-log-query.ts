export function buildBroadcastLogsQuery({
  logsPage,
  q,
}: {
  logsPage?: number;
  q?: string;
}) {
  const params = new URLSearchParams();
  const trimmedQuery = q?.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  if (logsPage && logsPage > 1) {
    params.set("logsPage", String(logsPage));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
