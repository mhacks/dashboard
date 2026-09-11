import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import {
  BROADCAST_LOGS_PAGE_SIZE,
  type BroadcastLogListItem,
  type BroadcastLogsFilter,
} from "@/lib/broadcast/log-types";
import { db } from "@/lib/db";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";
import { users } from "@/lib/db/schema/users";

export async function listBroadcastLogs(
  pageIndex = 0,
  pageSize = BROADCAST_LOGS_PAGE_SIZE,
  filter: BroadcastLogsFilter = {},
  options: { includeCount?: boolean } = {},
) {
  await requireOrganizer();
  const safePageIndex = Math.max(0, pageIndex);
  const safePageSize = Math.min(Math.max(pageSize, 1), 50);
  const includeCount = options.includeCount ?? true;
  const conditions: SQL[] = [];

  if (filter.target) {
    conditions.push(eq(broadcastLogs.target, filter.target));
  }

  const trimmedSearch = filter.search?.trim().slice(0, 100) ?? "";
  if (trimmedSearch) {
    const pattern = `%${trimmedSearch}%`;
    conditions.push(
      or(
        ilike(broadcastLogs.subject, pattern),
        ilike(broadcastLogs.body, pattern),
        ilike(users.email, pattern),
      ) as SQL,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const listQuery = db
    .select({
      id: broadcastLogs.id,
      target: broadcastLogs.target,
      subject: broadcastLogs.subject,
      body: broadcastLogs.body,
      sentAt: broadcastLogs.sentAt,
      status: broadcastLogs.status,
      failedCount: broadcastLogs.retryFailedCount,
      operatorEmail: users.email,
    })
    .from(broadcastLogs)
    .leftJoin(users, eq(broadcastLogs.sentBy, users.id))
    .where(whereClause)
    .orderBy(desc(broadcastLogs.sentAt))
    .limit(safePageSize)
    .offset(safePageIndex * safePageSize);

  if (!includeCount) {
    return {
      items: (await listQuery) satisfies BroadcastLogListItem[],
      totalCount: 0,
    };
  }

  const countQuery = db
    .select({
      totalCount: sql<number>`count(*)::int`,
    })
    .from(broadcastLogs);

  const [rows, countRows] = await Promise.all([
    listQuery,
    trimmedSearch
      ? countQuery
          .leftJoin(users, eq(broadcastLogs.sentBy, users.id))
          .where(whereClause)
      : countQuery.where(whereClause),
  ]);

  return {
    items: rows satisfies BroadcastLogListItem[],
    totalCount: countRows[0]?.totalCount ?? 0,
  };
}
