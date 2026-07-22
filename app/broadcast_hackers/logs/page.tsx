import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";
import { users } from "@/lib/db/schema/users";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import styles from "../styles.module.css";

export default async function BroadcastLogsPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "organizer") {
    redirect("/");
  }

  const logs = await db
    .select({
      id: broadcastLogs.id,
      subject: broadcastLogs.subject,
      body: broadcastLogs.body,
      sentAt: broadcastLogs.sentAt,
      broadcastedToEmail: broadcastLogs.broadcastedToEmail,
      broadcastedToText: broadcastLogs.broadcastedToText,
      operatorEmail: users.email,
    })
    .from(broadcastLogs)
    .leftJoin(users, eq(broadcastLogs.sentBy, users.id))
    .orderBy(desc(broadcastLogs.sentAt));

  return (
    <div className={styles.container} style={{ maxWidth: 900 }}>
      <h1>Broadcast Logs</h1>
      <a href="/broadcast_hackers" className={styles.button} style={{ marginBottom: 16, display: "inline-block" }}>
        ← Back
      </a>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Body</TableHead>
            <TableHead>Sent to Email</TableHead>
            <TableHead>Sent to Text</TableHead>
            <TableHead>Operator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const emailCount = (log.broadcastedToEmail as string[])?.length ?? 0;
            const textCount = (log.broadcastedToText as string[])?.length ?? 0;
            return (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(log.sentAt).toLocaleString()}
                </TableCell>
                <TableCell>{log.subject}</TableCell>
                <TableCell className="max-w-xs truncate">{log.body}</TableCell>
                <TableCell>
                  <a
                    href={`/broadcast_hackers/logs/${log.id}/recipients?type=email`}
                    className="underline"
                  >
                    {emailCount} addresses
                  </a>
                </TableCell>
                <TableCell>
                  <a
                    href={`/broadcast_hackers/logs/${log.id}/recipients?type=text`}
                    className="underline"
                  >
                    {textCount} numbers
                  </a>
                </TableCell>
                <TableCell>{log.operatorEmail ?? "—"}</TableCell>
              </TableRow>
            );
          })}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No broadcasts yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
