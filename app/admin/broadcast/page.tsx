import { BROADCAST_LOGS_PAGE_SIZE } from "@/lib/broadcast/log-types";
import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import { listBroadcastLogs } from "@/lib/queries/broadcast-logs";
import { BroadcastWorkspace } from "./BroadcastWorkspace";

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const [targets, { items: logs, totalCount }] = await Promise.all([
    listBroadcastTargetSummaries(),
    listBroadcastLogs(
      0,
      BROADCAST_LOGS_PAGE_SIZE,
      searchQuery ? { search: searchQuery } : {},
    ),
  ]);

  return (
    <BroadcastWorkspace
      targets={targets}
      searchQuery={searchQuery}
      initialLogs={logs}
      initialTotalCount={totalCount}
    />
  );
}
