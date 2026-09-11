import { desc, eq } from "drizzle-orm";
import { getBroadcastTarget } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import { db } from "@/lib/db";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";
import { users } from "@/lib/db/schema/users";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageHeader } from "../../components/admin-page-header";
import { AdminPageShell } from "../../components/admin-page-shell";

function targetLabel(targetId: string) {
  try {
    return getBroadcastTarget(targetId).label;
  } catch {
    return targetId;
  }
}

export default async function BroadcastLogsPage() {
  const logs = await db
    .select({
      id: broadcastLogs.id,
      target: broadcastLogs.target,
      subject: broadcastLogs.subject,
      body: broadcastLogs.body,
      sentAt: broadcastLogs.sentAt,
      status: broadcastLogs.status,
      deliveredTo: broadcastLogs.deliveredTo,
      recipients: broadcastLogs.recipients,
      failedCount: broadcastLogs.failedCount,
      operatorEmail: users.email,
    })
    .from(broadcastLogs)
    .leftJoin(users, eq(broadcastLogs.sentBy, users.id))
    .orderBy(desc(broadcastLogs.sentAt));

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Broadcast logs"
        description="Every broadcast sent, with the operator and recipient list."
      />

      <div>
        <Button asChild variant="outline">
          <a href="/admin/broadcast">← Back</a>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Body</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Operator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const sentCount = log.deliveredTo?.length ?? 0;
            const totalCount = log.recipients?.length ?? sentCount;
            const deliveryLabel =
              log.status === "sending"
                ? `${sentCount}/${totalCount} sent, ${log.failedCount} failed (in progress)`
                : `${sentCount} sent, ${log.failedCount} failed`;

            return (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(log.sentAt).toLocaleString()}
                </TableCell>
                <TableCell>{targetLabel(log.target)}</TableCell>
                <TableCell>{log.subject}</TableCell>
                <TableCell className="max-w-xs truncate">{log.body}</TableCell>
                <TableCell>{deliveryLabel}</TableCell>
                <TableCell>
                  <a
                    href={`/admin/broadcast/logs/${log.id}/recipients`}
                    className="underline"
                  >
                    {sentCount} delivered
                  </a>
                </TableCell>
                <TableCell>{log.operatorEmail ?? "—"}</TableCell>
              </TableRow>
            );
          })}
          {logs.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No broadcasts yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </AdminPageShell>
  );
}
