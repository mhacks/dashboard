import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  BROADCAST_LOGS_PAGE_SIZE,
  type BroadcastLogListItem,
} from "@/lib/broadcast/log-types";
import { db } from "@/lib/db";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";
import { users } from "@/lib/db/schema/users";

export {
  BROADCAST_LOGS_PAGE_SIZE,
  type BroadcastLogListItem,
} from "@/lib/broadcast/log-types";

export type BroadcastLogsFilter = {
  target?: string;
  search?: string;
};

export async function listBroadcastLogs(
  pageIndex = 0,
  pageSize = BROADCAST_LOGS_PAGE_SIZE,
  filter?: BroadcastLogsFilter,
) {
  const safePageIndex = Math.max(0, pageIndex);
  const safePageSize = Math.min(Math.max(pageSize, 1), 50);
  const conditions: SQL[] = [];

  if (filter?.target) {
    conditions.push(eq(broadcastLogs.target, filter.target));
  }

  const trimmedSearch = filter?.search?.trim().slice(0, 100) ?? "";
  if (trimmedSearch) {
    const pattern = `%${trimmedSearch}%`;
    conditions.push(
      or(
        ilike(broadcastLogs.subject, pattern),
        ilike(broadcastLogs.body, pattern),
        ilike(users.email, pattern),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
    .where(whereClause)
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
    })) satisfies BroadcastLogListItem[],
    totalCount: rows[0]?.totalCount ?? 0,
  };
}
