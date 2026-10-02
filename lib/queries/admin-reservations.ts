import { cache } from "react";
import { asc, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { selectTablesWithTeam } from "@/lib/db/queries/reservation";
import { reservationAuditLog, tables } from "@/lib/db/schema/reservation";
import { teams } from "@/lib/db/schema/teams";
import { getReservationSettings } from "@/lib/queries/reservation-settings";
import type { TableWithTeam } from "@/lib/reservation/types";

const DEFAULT_AUDIT_PAGE_SIZE = 20;
const MAX_AUDIT_PAGE_SIZE = 100;

const auditPageInputSchema = z.object({
  pageIndex: z.coerce.number().int().nonnegative().default(0),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_AUDIT_PAGE_SIZE)
    .default(DEFAULT_AUDIT_PAGE_SIZE),
});

export type AdminReservationDetail = {
  reservationsOpenAt: string | null;
  reservationsCloseAt: string | null;
  tableCount: number;
  assignedCount: number;
};

export type AdminReservationTeam = {
  id: string;
  name: string;
};

export type AdminReservationAssignmentsData = {
  teams: AdminReservationTeam[];
  tables: TableWithTeam[];
};

export type ReservationAuditItem = {
  id: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

export type ReservationAuditPage = {
  items: ReservationAuditItem[];
  totalItems: number;
  pageIndex: number;
  pageSize: number;
};

export const getAdminReservation = cache(
  async (): Promise<AdminReservationDetail> => {
    await requireOrganizer();
    const [settings, [counts]] = await Promise.all([
      getReservationSettings(),
      db
        .select({
          tableCount: sql<number>`count(*)::int`,
          assignedCount: sql<number>`count(${tables.reservedByTeamId})::int`,
        })
        .from(tables),
    ]);
    return {
      reservationsOpenAt: settings?.reservationsOpenAt ?? null,
      reservationsCloseAt: settings?.reservationsCloseAt ?? null,
      tableCount: counts?.tableCount ?? 0,
      assignedCount: counts?.assignedCount ?? 0,
    };
  },
);

export async function getAdminReservationTables(): Promise<TableWithTeam[]> {
  await requireOrganizer();
  return selectTablesWithTeam(db);
}

export async function getAdminReservationAssignments(): Promise<AdminReservationAssignmentsData> {
  await requireOrganizer();
  return db.transaction(
    async (tx) => {
      const reservationTeams = await tx
        .select({
          id: teams.id,
          name: teams.name,
        })
        .from(teams)
        .orderBy(asc(teams.name), asc(teams.id));
      return {
        teams: reservationTeams,
        tables: await selectTablesWithTeam(tx),
      };
    },
    {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    },
  );
}

export async function getReservationAuditPage(input: {
  pageIndex?: number;
  pageSize?: number;
}): Promise<ReservationAuditPage> {
  await requireOrganizer();
  const parsed = auditPageInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      items: [],
      totalItems: 0,
      pageIndex: 0,
      pageSize: DEFAULT_AUDIT_PAGE_SIZE,
    };
  }

  const { pageIndex, pageSize } = parsed.data;
  const { items, totalItems } = await db.transaction(
    async (tx) => {
      const [countRow] = await tx
        .select({ totalItems: sql<number>`count(*)::int` })
        .from(reservationAuditLog);
      const items = await tx
        .select({
          id: reservationAuditLog.id,
          actorUserId: reservationAuditLog.actorUserId,
          actorEmail: reservationAuditLog.actorEmail,
          action: reservationAuditLog.action,
          entityType: reservationAuditLog.entityType,
          entityId: reservationAuditLog.entityId,
          details: reservationAuditLog.details,
          createdAt: reservationAuditLog.createdAt,
        })
        .from(reservationAuditLog)
        .orderBy(
          desc(reservationAuditLog.createdAt),
          desc(reservationAuditLog.id),
        )
        .limit(pageSize)
        .offset(pageIndex * pageSize);

      return {
        items,
        totalItems: countRow?.totalItems ?? 0,
      };
    },
    {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    },
  );

  return {
    items,
    totalItems,
    pageIndex,
    pageSize,
  };
}
