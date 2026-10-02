import { cache } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
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

const tableWithTeamSelection = {
  id: tables.id,
  number: tables.number,
  reservedByTeamId: tables.reservedByTeamId,
  reservedByTeamName: teams.name,
};

export type AdminReservationDetail = {
  reservationsOpenAt: string | null;
  reservationsCloseAt: string | null;
  updatedAt: string;
  tableCount: number;
  assignedCount: number;
};

export type AdminReservationTablesData = {
  reservation: AdminReservationDetail;
  tables: TableWithTeam[];
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

async function loadReservationTables(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  return tx
    .select(tableWithTeamSelection)
    .from(tables)
    .leftJoin(teams, eq(tables.reservedByTeamId, teams.id))
    .orderBy(asc(tables.number), asc(tables.id));
}

function reservationDetail(
  settings: Awaited<ReturnType<typeof getReservationSettings>>,
  reservationTables: readonly TableWithTeam[],
): AdminReservationDetail {
  return {
    reservationsOpenAt: settings?.reservationsOpenAt ?? null,
    reservationsCloseAt: settings?.reservationsCloseAt ?? null,
    updatedAt: settings?.updatedAt ?? new Date(0).toISOString(),
    tableCount: reservationTables.length,
    assignedCount: reservationTables.filter((table) => table.reservedByTeamId)
      .length,
  };
}

export const getAdminReservation = cache(
  async (): Promise<AdminReservationDetail> => {
    await requireOrganizer();
    const [settings, reservationTables] = await Promise.all([
      getReservationSettings(),
      db
        .select(tableWithTeamSelection)
        .from(tables)
        .leftJoin(teams, eq(tables.reservedByTeamId, teams.id)),
    ]);
    return reservationDetail(settings, reservationTables);
  },
);

export async function getAdminReservationTables(): Promise<AdminReservationTablesData> {
  await requireOrganizer();
  return db.transaction(
    async (tx) => {
      const reservationTables = await loadReservationTables(tx);
      const settings = await getReservationSettings();
      return {
        reservation: reservationDetail(settings, reservationTables),
        tables: reservationTables,
      };
    },
    {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    },
  );
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
        tables: await loadReservationTables(tx),
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
