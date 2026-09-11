import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import { Card, CardContent } from "@/components/ui/card";
import {
  BROADCAST_LOGS_PAGE_SIZE,
  listBroadcastLogs,
} from "@/lib/queries/broadcast-logs";
import { AdminPageHeader } from "../components/admin-page-header";
import { AdminPageShell } from "../components/admin-page-shell";
import BroadcastForm from "./BroadcastForm";
import { BroadcastLogsPagination } from "./BroadcastLogsPagination";
import { BroadcastLogsTable } from "./BroadcastLogsTable";

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ logsPage?: string }>;
}) {
  const params = await searchParams;
  const pageIndex = Math.max(0, Number(params.logsPage ?? "1") - 1);
  const targets = await listBroadcastTargetSummaries();
  const { items: logs, totalCount } = await listBroadcastLogs(pageIndex);
  const totalRecipients = targets.reduce(
    (sum, target) => sum + target.recipientCount,
    0,
  );

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Broadcast"
        description={`Send a message to ${totalRecipients} recipients across ${targets.length} target${targets.length === 1 ? "" : "s"}. Use sparingly.`}
      />

      <Card className="max-w-3xl">
        <CardContent>
          <BroadcastForm targets={targets} />
        </CardContent>
      </Card>

      <section id="broadcast-logs" className="flex flex-col gap-3 scroll-mt-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Logs</h2>
          <p className="text-sm text-muted-foreground">
            Every broadcast sent, with the operator and recipient list.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <BroadcastLogsTable logs={logs} />
            <BroadcastLogsPagination
              pageIndex={pageIndex}
              totalCount={totalCount}
              pageSize={BROADCAST_LOGS_PAGE_SIZE}
            />
          </CardContent>
        </Card>
      </section>
    </AdminPageShell>
  );
}
