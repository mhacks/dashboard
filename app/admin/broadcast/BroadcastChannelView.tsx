import {
  BROADCAST_LOGS_PAGE_SIZE,
  listBroadcastLogs,
} from "@/lib/queries/broadcast-logs";
import type { BroadcastTargetSummary } from "@/lib/broadcast/types";
import BroadcastForm from "./BroadcastForm";
import { BroadcastChannelMobileNav } from "./BroadcastChannelSidebar";
import { BroadcastLogsPagination } from "./BroadcastLogsPagination";
import { BroadcastMessageFeed } from "./BroadcastMessageFeed";
import { BroadcastMessageScroll } from "./BroadcastMessageScroll";

type BroadcastChannelViewProps = {
  targets: BroadcastTargetSummary[];
  channelTargetId: string | null;
  pageIndex: number;
};

export async function BroadcastChannelView({
  targets,
  channelTargetId,
  pageIndex,
}: BroadcastChannelViewProps) {
  const channelTarget = channelTargetId
    ? targets.find((target) => target.id === channelTargetId)
    : null;

  if (channelTargetId && !channelTarget) {
    return null;
  }

  const { items: logs, totalCount } = await listBroadcastLogs(
    pageIndex,
    BROADCAST_LOGS_PAGE_SIZE,
    channelTargetId ? { target: channelTargetId } : undefined,
  );
  const targetLabels = Object.fromEntries(
    targets.map((target) => [target.id, target.label]),
  );
  const emptyMessage = channelTarget
    ? `No broadcasts to ${channelTarget.label} yet. Send the first message below.`
    : "No broadcasts yet. Send the first message below.";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      <BroadcastChannelMobileNav
        targets={targets}
        activeTargetId={channelTargetId}
      />

      <BroadcastMessageScroll
        scrollKey={`${channelTargetId ?? "global"}:${pageIndex}:${logs[logs.length - 1]?.id ?? "empty"}`}
      >
        <div className="flex flex-col gap-2 px-1 pb-2">
          {totalCount > BROADCAST_LOGS_PAGE_SIZE ? (
            <BroadcastLogsPagination
              pageIndex={pageIndex}
              totalCount={totalCount}
              pageSize={BROADCAST_LOGS_PAGE_SIZE}
            />
          ) : null}
          <BroadcastMessageFeed
            logs={logs}
            targetLabels={targetLabels}
            emptyMessage={emptyMessage}
          />
        </div>
      </BroadcastMessageScroll>

      <div className="shrink-0 -mx-4 border-t bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6">
        <BroadcastForm targets={targets} channelTargetId={channelTargetId} />
      </div>
    </div>
  );
}
