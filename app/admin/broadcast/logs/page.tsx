import { desc, eq } from "drizzle-orm";
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

export default async function BroadcastLogsPage() {
  const logs = await db
    .select({
      id: broadcastLogs.id,
      subject: broadcastLogs.subject,
      body: broadcastLogs.body,
      sentAt: broadcastLogs.sentAt,
      broadcastedToEmail: broadcastLogs.broadcastedToEmail,
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
            <TableHead>Subject</TableHead>
            <TableHead>Body</TableHead>
            <TableHead>Sent to email</TableHead>
            <TableHead>Operator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const emailCount = log.broadcastedToEmail?.length ?? 0;
            return (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(log.sentAt).toLocaleString()}
                </TableCell>
                <TableCell>{log.subject}</TableCell>
                <TableCell className="max-w-xs truncate">{log.body}</TableCell>
                <TableCell>
                  <a
                    href={`/admin/broadcast/logs/${log.id}/recipients`}
                    className="underline"
                  >
                    {emailCount} addresses
                  </a>
                </TableCell>
                <TableCell>{log.operatorEmail ?? "—"}</TableCell>
              </TableRow>
            );
          })}
          {logs.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
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
