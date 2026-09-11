import { buildBroadcastLogsFilter } from "@/lib/broadcast/log-filter";
import { BROADCAST_LOGS_PAGE_SIZE } from "@/lib/broadcast/log-types";
import { listBroadcastLogs } from "@/lib/queries/broadcast-logs";
import type { BroadcastTargetSummary } from "@/lib/broadcast/types";
import { BroadcastWorkspace } from "./BroadcastWorkspace";

export async function BroadcastChannelView({
  targets,
  searchQuery,
}: {
  targets: BroadcastTargetSummary[];
  searchQuery: string;
}) {
  const { items: logs, totalCount } = await listBroadcastLogs(
    0,
    BROADCAST_LOGS_PAGE_SIZE,
    buildBroadcastLogsFilter(null, searchQuery),
  );

  return (
    <BroadcastWorkspace
      targets={targets}
      searchQuery={searchQuery}
      initialLogs={logs}
      initialTotalCount={totalCount}
    />
  );
}
