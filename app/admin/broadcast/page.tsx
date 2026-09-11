import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import {
  BROADCAST_LOGS_PAGE_SIZE,
  listBroadcastLogs,
} from "@/lib/queries/broadcast-logs";
import { AdminPageHeader } from "../components/admin-page-header";
import { AdminPageShell } from "../components/admin-page-shell";
import BroadcastForm from "./BroadcastForm";
import { BroadcastLogsPagination } from "./BroadcastLogsPagination";
import { BroadcastMessageFeed } from "./BroadcastMessageFeed";
import { BroadcastMessageScroll } from "./BroadcastMessageScroll";

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ logsPage?: string }>;
}) {
  const params = await searchParams;
  const pageIndex = Math.max(0, Number(params.logsPage ?? "1") - 1);
  const targets = await listBroadcastTargetSummaries();
  const { items: logs, totalCount } = await listBroadcastLogs(pageIndex);
  const targetLabels = Object.fromEntries(
    targets.map((target) => [target.id, target.label]),
  );
  const totalRecipients = targets.reduce(
    (sum, target) => sum + target.recipientCount,
    0,
  );

  return (
    <AdminPageShell width="wide">
      <div className="mx-auto flex h-[calc(100dvh-2.5rem)] w-full max-w-3xl flex-col gap-3 lg:max-w-4xl">
        <AdminPageHeader
          title="Broadcast"
          description={`One-way announcements to ${totalRecipients} recipients across ${targets.length} target${targets.length === 1 ? "" : "s"}. Use sparingly.`}
        />

        <BroadcastMessageScroll
          scrollKey={`${pageIndex}:${logs[logs.length - 1]?.id ?? "empty"}`}
        >
          <div className="flex flex-col gap-2 px-1 pb-2">
            {totalCount > BROADCAST_LOGS_PAGE_SIZE ? (
              <BroadcastLogsPagination
                pageIndex={pageIndex}
                totalCount={totalCount}
                pageSize={BROADCAST_LOGS_PAGE_SIZE}
              />
            ) : null}
            <BroadcastMessageFeed logs={logs} targetLabels={targetLabels} />
          </div>
        </BroadcastMessageScroll>

        <div className="shrink-0 -mx-4 border-t bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6">
          <BroadcastForm targets={targets} />
        </div>
      </div>
    </AdminPageShell>
  );
}
