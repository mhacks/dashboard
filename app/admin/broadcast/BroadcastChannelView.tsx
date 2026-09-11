import { buildBroadcastLogsFilter } from "@/lib/broadcast/log-filter";
import { BROADCAST_LOGS_PAGE_SIZE } from "@/lib/broadcast/log-types";
import { listBroadcastLogs } from "@/lib/queries/broadcast-logs";
import type { BroadcastTargetSummary } from "@/lib/broadcast/types";
import BroadcastForm from "./BroadcastForm";
import { BroadcastChannelMobileNav } from "./BroadcastChannelSidebar";
import { BroadcastLogsSearch } from "./BroadcastLogsSearch";
import { BroadcastMessageFeedPanel } from "./BroadcastMessageFeedPanel";

type BroadcastChannelViewProps = {
  targets: BroadcastTargetSummary[];
  channelTargetId: string | null;
  searchQuery: string;
};

export async function BroadcastChannelView({
  targets,
  channelTargetId,
  searchQuery,
}: BroadcastChannelViewProps) {
  const channelTarget = channelTargetId
    ? targets.find((target) => target.id === channelTargetId)
    : null;

  const { items: logs, totalCount } = await listBroadcastLogs(
    0,
    BROADCAST_LOGS_PAGE_SIZE,
    buildBroadcastLogsFilter(channelTargetId, searchQuery),
  );
  const targetLabels = Object.fromEntries(
    targets.map((target) => [target.id, target.label]),
  );
  const emptyMessage = searchQuery
    ? "No broadcasts match your search."
    : channelTarget
      ? `No broadcasts to ${channelTarget.label} yet. Send the first message below.`
      : "No broadcasts yet. Send the first message below.";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      <BroadcastChannelMobileNav
        targets={targets}
        activeTargetId={channelTargetId}
      />

      <BroadcastLogsSearch
        initialQuery={searchQuery}
        channelLabel={channelTarget?.label ?? "Global"}
      />

      <BroadcastMessageFeedPanel
        key={`${channelTargetId ?? "global"}:${searchQuery}`}
        initialLogs={logs}
        totalCount={totalCount}
        channelTargetId={channelTargetId}
        searchQuery={searchQuery}
        targetLabels={targetLabels}
        emptyMessage={emptyMessage}
      />

      <div className="shrink-0 -mx-4 border-t bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6">
        <BroadcastForm targets={targets} channelTargetId={channelTargetId} />
      </div>
    </div>
  );
}
