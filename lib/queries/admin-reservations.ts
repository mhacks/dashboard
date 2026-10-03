import { cache } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { selectTablesWithTeam } from "@/lib/db/queries/reservation";
import {
  judgingSettings,
  reservationAuditLog,
  tables,
} from "@/lib/db/schema/reservation";
import { teams } from "@/lib/db/schema/teams";
import {
  DEFAULT_MAP_COLUMNS,
  DEFAULT_MAP_ROWS,
} from "@/lib/reservation/domain";
import {
  getJudgingSettings,
  JUDGING_SETTINGS_ID,
} from "@/lib/queries/judging-settings";
import { getSubmissionSettings } from "@/lib/queries/submission-settings";
import { getTeamRegistrationSettings } from "@/lib/queries/team-registration-settings";
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

export type AdminWindow = {
  opensAt: string | null;
  closesAt: string | null;
};

export type AdminReservationDetail = {
  registration: AdminWindow;
  reservation: AdminWindow;
  submission: AdminWindow;
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
  columns: number;
  rows: number;
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
    const [registration, reservation, submission, [counts]] = await Promise.all(
      [
        getTeamRegistrationSettings(),
        getJudgingSettings(),
        getSubmissionSettings(),
        db
          .select({
            tableCount: sql<number>`count(*)::int`,
            assignedCount: sql<number>`count(${tables.reservedByTeamId})::int`,
          })
          .from(tables),
      ],
    );
    return {
      registration: {
        opensAt: registration?.opensAt ?? null,
        closesAt: registration?.closesAt ?? null,
      },
      reservation: {
        opensAt: reservation?.reservationsOpenAt ?? null,
        closesAt: reservation?.reservationsCloseAt ?? null,
      },
      submission: {
        opensAt: submission?.opensAt ?? null,
        closesAt: submission?.closesAt ?? null,
      },
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
      const [settings] = await tx
        .select({
          mapColumns: judgingSettings.mapColumns,
          mapRows: judgingSettings.mapRows,
        })
        .from(judgingSettings)
        .where(eq(judgingSettings.id, JUDGING_SETTINGS_ID))
        .limit(1);
      return {
        teams: reservationTeams,
        tables: await selectTablesWithTeam(tx),
        columns: settings?.mapColumns ?? DEFAULT_MAP_COLUMNS,
        rows: settings?.mapRows ?? DEFAULT_MAP_ROWS,
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
