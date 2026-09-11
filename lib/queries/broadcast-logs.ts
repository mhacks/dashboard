import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";
import { users } from "@/lib/db/schema/users";

export const BROADCAST_LOGS_PAGE_SIZE = 25;

export type BroadcastLogListItem = {
  id: string;
  target: string;
  subject: string;
  body: string;
  sentAt: Date;
  status: string;
  deliveredTo: string[] | null;
  recipients: string[] | null;
  failedCount: number;
  operatorEmail: string | null;
};

export async function listBroadcastLogs(
  pageIndex = 0,
  pageSize = BROADCAST_LOGS_PAGE_SIZE,
) {
  const safePageIndex = Math.max(0, pageIndex);
  const safePageSize = Math.min(Math.max(pageSize, 1), 50);

  const rows = await db
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
      totalCount: sql<number>`count(*) over()::int`,
    })
    .from(broadcastLogs)
    .leftJoin(users, eq(broadcastLogs.sentBy, users.id))
    .orderBy(desc(broadcastLogs.sentAt))
    .limit(safePageSize)
    .offset(safePageIndex * safePageSize);

  return {
    items: rows.map((row) => ({
      id: row.id,
      target: row.target,
      subject: row.subject,
      body: row.body,
      sentAt: row.sentAt,
      status: row.status,
      deliveredTo: row.deliveredTo,
      recipients: row.recipients,
      failedCount: row.failedCount,
      operatorEmail: row.operatorEmail,
    })),
    totalCount: rows[0]?.totalCount ?? 0,
  };
}
