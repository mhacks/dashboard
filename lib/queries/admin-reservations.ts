import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  events,
  reservationAuditLog,
  tables,
  teams,
  type Team,
} from "@/lib/db/schema/reservation";
import {
  getReservationAvailability,
  type ReservationAvailability,
  type ReservationEventStatus,
} from "@/lib/reservation/domain";
import type { TableWithTeam } from "@/lib/reservation/types";
import { reservationIdSchema } from "@/lib/reservation/validation";

const DEFAULT_AUDIT_PAGE_SIZE = 20;
const MAX_AUDIT_PAGE_SIZE = 100;

const auditPageInputSchema = z.object({
  eventId: reservationIdSchema.optional(),
  pageIndex: z.coerce.number().int().nonnegative().default(0),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_AUDIT_PAGE_SIZE)
    .default(DEFAULT_AUDIT_PAGE_SIZE),
});

const eventSummarySelection = {
  id: events.id,
  name: events.name,
  status: events.status,
  startsAt: events.startsAt,
  reservationsOpenAt: events.reservationsOpenAt,
  reservationsCloseAt: events.reservationsCloseAt,
  tableCount: sql<number>`count(${tables.id})::int`,
  assignedCount: sql<number>`count(${tables.reservedByTeamId})::int`,
};

export type AdminReservationEventSummary = {
  id: string;
  name: string;
  status: ReservationEventStatus;
  startsAt: Date | null;
  reservationsOpenAt: Date | null;
  reservationsCloseAt: Date | null;
  tableCount: number;
  assignedCount: number;
};

export type AdminReservationEventListItem = AdminReservationEventSummary & {
  reservationAvailability: ReservationAvailability;
};

export type AdminReservationEventDetail = AdminReservationEventSummary & {
  description: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminReservationTablesData = {
  event: AdminReservationEventDetail;
  tables: TableWithTeam[];
};

export type AdminReservationTeam = Team & {
  tableId: string | null;
  tableNumber: number | null;
};

export type AdminReservationAssignmentsData = {
  event: AdminReservationEventDetail;
  teams: AdminReservationTeam[];
  tables: TableWithTeam[];
};

export type ReservationAuditItem = {
  id: string;
  eventId: string | null;
  eventName: string;
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

export function toAdminReservationEventListItem(
  event: AdminReservationEventSummary,
  referenceTime: Date,
): AdminReservationEventListItem {
  return {
    ...event,
    reservationAvailability: getReservationAvailability(event, referenceTime),
  };
}

export async function listAdminReservationEvents(): Promise<
  AdminReservationEventListItem[]
> {
  await requireOrganizer();
  const referenceTime = new Date();

  const reservationEvents = await db
    .select(eventSummarySelection)
    .from(events)
    .leftJoin(tables, eq(tables.eventId, events.id))
    .groupBy(events.id)
    .orderBy(desc(events.createdAt), desc(events.id));

  return reservationEvents.map((event) =>
    toAdminReservationEventListItem(event, referenceTime),
  );
}

export async function getAdminReservationEvent(
  eventId: string,
): Promise<AdminReservationEventDetail | null> {
  await requireOrganizer();
  const parsedEventId = reservationIdSchema.safeParse(eventId);
  if (!parsedEventId.success) return null;

  const [event] = await db
    .select({
      ...eventSummarySelection,
      description: events.description,
      location: events.location,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .leftJoin(tables, eq(tables.eventId, events.id))
    .where(eq(events.id, parsedEventId.data))
    .groupBy(events.id)
    .limit(1);

  return event ?? null;
}

export async function getAdminReservationTables(
  eventId: string,
): Promise<AdminReservationTablesData | null> {
  await requireOrganizer();
  const parsedEventId = reservationIdSchema.safeParse(eventId);
  if (!parsedEventId.success) return null;

  return db.transaction(
    async (tx) => {
      const [event] = await tx
        .select({
          ...eventSummarySelection,
          description: events.description,
          location: events.location,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
        })
        .from(events)
        .leftJoin(tables, eq(tables.eventId, events.id))
        .where(eq(events.id, parsedEventId.data))
        .groupBy(events.id)
        .limit(1);
      if (!event) return null;

      const eventTables = await tx
        .select({
          id: tables.id,
          number: tables.number,
          reservedByTeamId: tables.reservedByTeamId,
          reservedByTeamName: teams.name,
        })
        .from(tables)
        .leftJoin(teams, eq(tables.reservedByTeamId, teams.id))
        .where(eq(tables.eventId, parsedEventId.data))
        .orderBy(asc(tables.number), asc(tables.id));

      return { event, tables: eventTables };
    },
    {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    },
  );
}

export async function getAdminReservationAssignments(
  eventId: string,
): Promise<AdminReservationAssignmentsData | null> {
  await requireOrganizer();
  const parsedEventId = reservationIdSchema.safeParse(eventId);
  if (!parsedEventId.success) return null;

  return db.transaction(
    async (tx) => {
      const [event] = await tx
        .select({
          ...eventSummarySelection,
          description: events.description,
          location: events.location,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
        })
        .from(events)
        .leftJoin(tables, eq(tables.eventId, events.id))
        .where(eq(events.id, parsedEventId.data))
        .groupBy(events.id)
        .limit(1);
      if (!event) return null;

      const reservationTeams = await tx
        .select({
          id: teams.id,
          name: teams.name,
          createdAt: teams.createdAt,
          tableId: tables.id,
          tableNumber: tables.number,
        })
        .from(teams)
        .leftJoin(
          tables,
          and(
            eq(tables.reservedByTeamId, teams.id),
            eq(tables.eventId, parsedEventId.data),
          ),
        )
        .orderBy(asc(teams.name), asc(teams.id));
      const eventTables = await tx
        .select({
          id: tables.id,
          number: tables.number,
          reservedByTeamId: tables.reservedByTeamId,
          reservedByTeamName: teams.name,
        })
        .from(tables)
        .leftJoin(teams, eq(tables.reservedByTeamId, teams.id))
        .where(eq(tables.eventId, parsedEventId.data))
        .orderBy(asc(tables.number), asc(tables.id));

      return {
        event,
        teams: reservationTeams,
        tables: eventTables,
      };
    },
    {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    },
  );
}

export async function getReservationAuditPage(input: {
  eventId?: string;
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

  const { eventId, pageIndex, pageSize } = parsed.data;
  const filter = eventId ? eq(reservationAuditLog.eventId, eventId) : undefined;
  const { items, totalItems } = await db.transaction(
    async (tx) => {
      const [countRow] = await tx
        .select({ totalItems: sql<number>`count(*)::int` })
        .from(reservationAuditLog)
        .where(filter);
      const items = await tx
        .select({
          id: reservationAuditLog.id,
          eventId: reservationAuditLog.eventId,
          eventName: reservationAuditLog.eventName,
          actorUserId: reservationAuditLog.actorUserId,
          actorEmail: reservationAuditLog.actorEmail,
          action: reservationAuditLog.action,
          entityType: reservationAuditLog.entityType,
          entityId: reservationAuditLog.entityId,
          details: reservationAuditLog.details,
          createdAt: reservationAuditLog.createdAt,
        })
        .from(reservationAuditLog)
        .where(filter)
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
