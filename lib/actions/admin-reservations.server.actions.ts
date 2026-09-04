"use server";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  events,
  tables,
  teams,
  type Event as ReservationEventRow,
} from "@/lib/db/schema/reservation";
import { writeReservationAudit } from "@/lib/reservation/audit";
import {
  MAX_RESERVATION_TABLE_NUMBER,
  planTableCountChange,
} from "@/lib/reservation/domain";
import {
  reservationEventInputSchema,
  reservationIdSchema,
  reservationTableCountSchema,
  reservationTableNumberSchema,
  reservationTableTopologySchema,
  type ReservationEventInput,
  type ReservationTableTopology,
} from "@/lib/reservation/validation";

export type ReservationActionResult<T = never> =
  | { ok: true; message: string; data?: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

type EventFailureCode =
  | "EVENT_NOT_FOUND"
  | "ARCHIVED"
  | "ALREADY_ARCHIVED"
  | "NOT_ARCHIVED"
  | "ASSIGNMENTS_EXIST";

type EventOperation = "create" | "update" | "archive" | "restore" | "delete";

type TableFailureCode =
  | "TABLE_NOT_FOUND"
  | "TABLE_NUMBER_OCCUPIED"
  | "TABLE_ASSIGNED"
  | "COUNT_BLOCKED"
  | "TABLE_NUMBER_LIMIT"
  | "TOPOLOGY_CONFLICT";

type TableOperation = "create" | "renumber" | "delete" | "set count";

type AssignmentFailureCode =
  | "TEAM_NOT_FOUND"
  | "TABLE_NOT_FOUND"
  | "TEAM_NOT_ASSIGNED"
  | "CONFIRMATION_CONFLICT";

type AssignmentOperation = "move" | "unassign";

const eventFailureMessages: Record<
  Exclude<EventFailureCode, "ASSIGNMENTS_EXIST">,
  string
> = {
  EVENT_NOT_FOUND: "That event no longer exists.",
  ARCHIVED: "Archived events are read-only. Restore the event before editing.",
  ALREADY_ARCHIVED: "That event is already archived.",
  NOT_ARCHIVED: "Only archived events can be restored.",
};

const unexpectedFailureMessages: Record<EventOperation, string> = {
  create: "Could not create the event. Try again.",
  update: "Could not update the event. Try again.",
  archive: "Could not archive the event. Try again.",
  restore: "Could not restore the event. Try again.",
  delete: "Could not delete the event. Try again.",
};

const unexpectedTableFailureMessages: Record<TableOperation, string> = {
  create: "Could not create the table. Try again.",
  renumber: "Could not renumber the table. Try again.",
  delete: "Could not delete the table. Try again.",
  "set count": "Could not change the table count. Try again.",
};

const unexpectedAssignmentFailureMessages: Record<AssignmentOperation, string> =
  {
    move: "Could not move the team. Try again.",
    unassign: "Could not unassign the team. Try again.",
  };

const eventIdInputSchema = z.object({
  eventId: reservationIdSchema,
});

const createTableInputSchema = z.object({
  eventId: reservationIdSchema,
  number: reservationTableNumberSchema,
});

const tableMutationInputSchema = createTableInputSchema.extend({
  tableId: reservationIdSchema,
});

const deleteTableInputSchema = z.object({
  eventId: reservationIdSchema,
  tableId: reservationIdSchema,
});

const tableCountInputSchema = z.object({
  eventId: reservationIdSchema,
  count: reservationTableCountSchema,
  expectedTables: reservationTableTopologySchema,
});

const moveAssignmentInputSchema = z
  .object({
    eventId: reservationIdSchema,
    teamId: reservationIdSchema,
    tableId: reservationIdSchema,
    expectedSourceTableId: reservationIdSchema.nullable(),
    expectedSourceTableNumber: reservationTableNumberSchema.nullable(),
    expectedDestinationTableNumber: reservationTableNumberSchema,
    expectedDestinationTeamId: reservationIdSchema.nullable(),
  })
  .refine(
    (value) =>
      (value.expectedSourceTableId === null) ===
      (value.expectedSourceTableNumber === null),
    {
      path: ["expectedSourceTableNumber"],
      message: "Expected source table ID and number must both be set or null.",
    },
  );

const unassignAssignmentInputSchema = z.object({
  eventId: reservationIdSchema,
  teamId: reservationIdSchema,
  expectedSourceTableId: reservationIdSchema,
  expectedSourceTableNumber: reservationTableNumberSchema,
});

const updateEnvelopeSchema = z.object({
  eventId: z.unknown(),
  values: z.unknown(),
});

class EventFailure extends Error {
  constructor(
    readonly code: EventFailureCode,
    readonly context: { occupiedTableNumbers?: number[] } = {},
  ) {
    super(code);
  }
}

class TableFailure extends Error {
  constructor(
    readonly code: TableFailureCode,
    readonly context: {
      tableNumber?: number;
      blockedNumbers?: number[];
    } = {},
  ) {
    super(code);
  }
}

class AssignmentFailure extends Error {
  constructor(readonly code: AssignmentFailureCode) {
    super(code);
  }
}

function validationFailure(error: z.ZodError): ReservationActionResult {
  return {
    ok: false,
    error: "Check the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function postgresErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return postgresErrorCode(error.cause);
  return null;
}

function formatTableNumberList(numbers: readonly number[]): string {
  const labels = numbers.map(String);
  if (labels.length < 2) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function knownEventFailure(error: unknown): ReservationActionResult | null {
  if (error instanceof EventFailure) {
    if (error.code === "ASSIGNMENTS_EXIST") {
      const occupied = error.context.occupiedTableNumbers ?? [];
      const tableLabel = formatTableNumberList(occupied);
      return {
        ok: false,
        error:
          occupied.length === 1
            ? `Unassign the team from occupied table ${tableLabel} before deleting this event.`
            : `Unassign teams from occupied tables ${tableLabel} before deleting this event.`,
      };
    }
    return { ok: false, error: eventFailureMessages[error.code] };
  }

  switch (postgresErrorCode(error)) {
    case "23505":
      return {
        ok: false,
        error: "An event with those values already exists.",
      };
    case "23514":
      return {
        ok: false,
        error: "The event details conflict with database rules.",
      };
    case "23503":
      return {
        ok: false,
        error: "A related record no longer exists. Refresh and try again.",
      };
    default:
      return null;
  }
}

function eventActionFailure(
  error: unknown,
  operation: EventOperation,
): ReservationActionResult {
  const known = knownEventFailure(error);
  if (known) return known;
  console.error(`Unable to ${operation} reservation event:`, error);
  return { ok: false, error: unexpectedFailureMessages[operation] };
}

function tableActionFailure(
  error: unknown,
  operation: TableOperation,
): ReservationActionResult {
  if (error instanceof EventFailure) {
    const eventFailure = knownEventFailure(error);
    if (eventFailure) return eventFailure;
  }
  if (error instanceof TableFailure) {
    switch (error.code) {
      case "TABLE_NOT_FOUND":
        return {
          ok: false,
          error: "That table no longer exists for this event.",
        };
      case "TABLE_NUMBER_OCCUPIED":
        return {
          ok: false,
          error: "That table number is already in use.",
        };
      case "TABLE_ASSIGNED":
        return {
          ok: false,
          error: `Table ${error.context.tableNumber} is assigned. Unassign the team first.`,
        };
      case "COUNT_BLOCKED":
        return {
          ok: false,
          error: `Cannot remove assigned tables: ${error.context.blockedNumbers?.join(", ")}. Unassign them first.`,
        };
      case "TABLE_NUMBER_LIMIT":
        return {
          ok: false,
          error: `Cannot add tables because table numbers would exceed ${MAX_RESERVATION_TABLE_NUMBER.toLocaleString("en-US")}.`,
        };
      case "TOPOLOGY_CONFLICT":
        return {
          ok: false,
          error:
            "Table layout changed since this count was reviewed. Refresh and try again.",
        };
    }
  }

  switch (postgresErrorCode(error)) {
    case "23505":
      return {
        ok: false,
        error: "That table number is already in use.",
      };
    case "23514":
      return {
        ok: false,
        error: "The table details conflict with database rules.",
      };
    case "23503":
      return {
        ok: false,
        error: "A related record no longer exists. Refresh and try again.",
      };
    default:
      console.error(`Unable to ${operation} reservation table:`, error);
      return {
        ok: false,
        error: unexpectedTableFailureMessages[operation],
      };
  }
}

function assignmentActionFailure(
  error: unknown,
  operation: AssignmentOperation,
): ReservationActionResult {
  if (error instanceof EventFailure) {
    const eventFailure = knownEventFailure(error);
    if (eventFailure) return eventFailure;
  }
  if (error instanceof AssignmentFailure) {
    switch (error.code) {
      case "TEAM_NOT_FOUND":
        return { ok: false, error: "That team no longer exists." };
      case "TABLE_NOT_FOUND":
        return {
          ok: false,
          error: "That table no longer exists for this event.",
        };
      case "TEAM_NOT_ASSIGNED":
        return {
          ok: false,
          error: "That team is not assigned to this event.",
        };
      case "CONFIRMATION_CONFLICT":
        return {
          ok: false,
          error:
            "Assignments changed since this confirmation was opened. Refresh and try again.",
        };
    }
  }

  switch (postgresErrorCode(error)) {
    case "23505":
      return {
        ok: false,
        error: "That team already has a table for this event.",
      };
    case "23514":
      return {
        ok: false,
        error: "The assignment conflicts with database rules.",
      };
    case "23503":
      return {
        ok: false,
        error: "A related record no longer exists. Refresh and try again.",
      };
    default:
      console.error(`Unable to ${operation} reservation team:`, error);
      return {
        ok: false,
        error: unexpectedAssignmentFailureMessages[operation],
      };
  }
}

function eventSnapshot(event: ReservationEventRow) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    startsAt: event.startsAt?.toISOString() ?? null,
    location: event.location,
    status: event.status,
    reservationsOpenAt: event.reservationsOpenAt?.toISOString() ?? null,
    reservationsCloseAt: event.reservationsCloseAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function revalidateReservationEventPaths(eventId: string) {
  for (const path of [
    "/reserve",
    "/admin/reservations",
    "/admin/reservations/audit",
    `/admin/reservations/${eventId}`,
    `/admin/reservations/${eventId}/tables`,
    `/admin/reservations/${eventId}/assignments`,
    `/admin/reservations/${eventId}/audit`,
    `/admin/reservations/${eventId}/preview`,
  ]) {
    revalidatePath(path);
  }
}

type ReservationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

async function lockReservationTableTopology(
  tx: ReservationTransaction,
  eventId: string,
) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(
      hashtextextended((${eventId}::uuid)::text, 0)
    )`,
  );
}

function sameTableTopology(
  current: ReservationTableTopology,
  expected: ReservationTableTopology,
): boolean {
  if (current.length !== expected.length) return false;
  const byId = (
    left: ReservationTableTopology[number],
    right: ReservationTableTopology[number],
  ) => left.id.localeCompare(right.id);
  const currentSorted = [...current].sort(byId);
  const expectedSorted = [...expected].sort(byId);

  return currentSorted.every((table, index) => {
    const reviewed = expectedSorted[index];
    return (
      reviewed !== undefined &&
      table.id === reviewed.id &&
      table.number === reviewed.number &&
      table.reservedByTeamId === reviewed.reservedByTeamId
    );
  });
}

async function getLockedEvent(
  tx: ReservationTransaction,
  eventId: string,
): Promise<ReservationEventRow> {
  const [event] = await tx
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .for("update")
    .limit(1);
  if (!event) throw new EventFailure("EVENT_NOT_FOUND");
  return event;
}

async function getShareLockedEvent(
  tx: ReservationTransaction,
  eventId: string,
): Promise<ReservationEventRow> {
  const [event] = await tx
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .for("share")
    .limit(1);
  if (!event) throw new EventFailure("EVENT_NOT_FOUND");
  return event;
}

function requireMutableEvent(event: ReservationEventRow) {
  if (event.status === "archived") throw new EventFailure("ARCHIVED");
}

export async function createReservationEvent(
  input: ReservationEventInput,
): Promise<ReservationActionResult<{ eventId: string }>> {
  const organizer = await requireOrganizer();
  const parsed = reservationEventInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let eventId: string;
  try {
    eventId = await db.transaction(async (tx) => {
      const [event] = await tx.insert(events).values(parsed.data).returning();
      await writeReservationAudit(tx, {
        eventId: event.id,
        eventName: event.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "event.created",
        entityType: "event",
        entityId: event.id,
        details: { after: eventSnapshot(event) },
      });
      return event.id;
    });
  } catch (error) {
    return eventActionFailure(error, "create");
  }

  revalidateReservationEventPaths(eventId);
  return {
    ok: true,
    message: "Event created.",
    data: { eventId },
  };
}

export async function updateReservationEvent(input: {
  eventId: string;
  values: ReservationEventInput;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const envelope = updateEnvelopeSchema.safeParse(input);
  if (!envelope.success) return validationFailure(envelope.error);
  const parsedEventId = eventIdInputSchema.safeParse({
    eventId: envelope.data.eventId,
  });
  if (!parsedEventId.success) return validationFailure(parsedEventId.error);
  const parsedValues = reservationEventInputSchema.safeParse(
    envelope.data.values,
  );
  if (!parsedValues.success) return validationFailure(parsedValues.error);
  const eventId = parsedEventId.data.eventId;

  try {
    await db.transaction(async (tx) => {
      const before = await getLockedEvent(tx, eventId);
      if (before.status === "archived") throw new EventFailure("ARCHIVED");
      const [after] = await tx
        .update(events)
        .set({ ...parsedValues.data, updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning();
      await writeReservationAudit(tx, {
        eventId,
        eventName: after.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "event.updated",
        entityType: "event",
        entityId: eventId,
        details: {
          before: eventSnapshot(before),
          after: eventSnapshot(after),
        },
      });
    });
  } catch (error) {
    return eventActionFailure(error, "update");
  }

  revalidateReservationEventPaths(eventId);
  return { ok: true, message: "Event updated." };
}

export async function archiveReservationEvent(
  eventId: string,
): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = eventIdInputSchema.safeParse({ eventId });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await db.transaction(async (tx) => {
      const before = await getLockedEvent(tx, parsed.data.eventId);
      if (before.status === "archived") {
        throw new EventFailure("ALREADY_ARCHIVED");
      }
      const [after] = await tx
        .update(events)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(events.id, parsed.data.eventId))
        .returning();
      await writeReservationAudit(tx, {
        eventId: after.id,
        eventName: after.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "event.archived",
        entityType: "event",
        entityId: after.id,
        details: {
          before: eventSnapshot(before),
          after: eventSnapshot(after),
        },
      });
    });
  } catch (error) {
    return eventActionFailure(error, "archive");
  }

  revalidateReservationEventPaths(parsed.data.eventId);
  return { ok: true, message: "Event archived." };
}

export async function restoreReservationEvent(
  eventId: string,
): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = eventIdInputSchema.safeParse({ eventId });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await db.transaction(async (tx) => {
      const before = await getLockedEvent(tx, parsed.data.eventId);
      if (before.status !== "archived") {
        throw new EventFailure("NOT_ARCHIVED");
      }
      const [after] = await tx
        .update(events)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(events.id, parsed.data.eventId))
        .returning();
      await writeReservationAudit(tx, {
        eventId: after.id,
        eventName: after.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "event.restored",
        entityType: "event",
        entityId: after.id,
        details: {
          before: eventSnapshot(before),
          after: eventSnapshot(after),
        },
      });
    });
  } catch (error) {
    return eventActionFailure(error, "restore");
  }

  revalidateReservationEventPaths(parsed.data.eventId);
  return { ok: true, message: "Event restored to closed." };
}

export async function deleteReservationEvent(
  eventId: string,
): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = eventIdInputSchema.safeParse({ eventId });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await db.transaction(async (tx) => {
      const event = await getLockedEvent(tx, parsed.data.eventId);
      const eventTables = await tx
        .select({
          id: tables.id,
          number: tables.number,
          reservedByTeamId: tables.reservedByTeamId,
        })
        .from(tables)
        .where(eq(tables.eventId, parsed.data.eventId))
        .orderBy(asc(tables.id))
        .for("update");
      const occupiedTableNumbers = eventTables
        .filter((table) => table.reservedByTeamId)
        .map((table) => table.number)
        .sort((left, right) => left - right);
      if (occupiedTableNumbers.length > 0) {
        throw new EventFailure("ASSIGNMENTS_EXIST", {
          occupiedTableNumbers,
        });
      }

      await writeReservationAudit(tx, {
        eventId: event.id,
        eventName: event.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "event.deleted",
        entityType: "event",
        entityId: event.id,
        details: { before: eventSnapshot(event) },
      });
      await tx.delete(events).where(eq(events.id, event.id));
    });
  } catch (error) {
    return eventActionFailure(error, "delete");
  }

  revalidateReservationEventPaths(parsed.data.eventId);
  return { ok: true, message: "Event deleted." };
}

export async function createReservationTable(input: {
  eventId: string;
  number: number;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = createTableInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { eventId, number } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTableTopology(tx, eventId);
      const event = await getShareLockedEvent(tx, eventId);
      requireMutableEvent(event);
      const [table] = await tx
        .insert(tables)
        .values({ eventId, number })
        .returning({ id: tables.id, number: tables.number });
      await writeReservationAudit(tx, {
        eventId,
        eventName: event.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "table.created",
        entityType: "table",
        entityId: table.id,
        details: {
          tableId: table.id,
          tableNumber: table.number,
        },
      });
    });
  } catch (error) {
    return tableActionFailure(error, "create");
  }

  revalidateReservationEventPaths(eventId);
  return { ok: true, message: `Table ${number} created.` };
}

export async function renumberReservationTable(input: {
  eventId: string;
  tableId: string;
  number: number;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = tableMutationInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { eventId, tableId, number } = parsed.data;
  let previousNumber = number;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTableTopology(tx, eventId);
      const event = await getShareLockedEvent(tx, eventId);
      requireMutableEvent(event);
      const lockedTables = await tx
        .select({
          id: tables.id,
          number: tables.number,
        })
        .from(tables)
        .where(
          and(
            eq(tables.eventId, eventId),
            or(eq(tables.id, tableId), eq(tables.number, number)),
          ),
        )
        .orderBy(asc(tables.id))
        .for("update");
      const before = lockedTables.find((table) => table.id === tableId);
      if (!before) throw new TableFailure("TABLE_NOT_FOUND");
      if (
        lockedTables.some(
          (table) => table.id !== tableId && table.number === number,
        )
      ) {
        throw new TableFailure("TABLE_NUMBER_OCCUPIED");
      }

      const [after] = await tx
        .update(tables)
        .set({ number })
        .where(eq(tables.id, tableId))
        .returning({ id: tables.id, number: tables.number });
      previousNumber = before.number;
      await writeReservationAudit(tx, {
        eventId,
        eventName: event.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "table.renumbered",
        entityType: "table",
        entityId: after.id,
        details: {
          tableId: after.id,
          beforeNumber: before.number,
          afterNumber: after.number,
        },
      });
    });
  } catch (error) {
    return tableActionFailure(error, "renumber");
  }

  revalidateReservationEventPaths(eventId);
  return {
    ok: true,
    message: `Table ${previousNumber} renumbered to ${number}.`,
  };
}

export async function deleteReservationTable(input: {
  eventId: string;
  tableId: string;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = deleteTableInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { eventId, tableId } = parsed.data;
  let deletedNumber = 0;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTableTopology(tx, eventId);
      const event = await getShareLockedEvent(tx, eventId);
      requireMutableEvent(event);
      const [table] = await tx
        .select({
          id: tables.id,
          number: tables.number,
          reservedByTeamId: tables.reservedByTeamId,
        })
        .from(tables)
        .where(and(eq(tables.id, tableId), eq(tables.eventId, eventId)))
        .for("update")
        .limit(1);
      if (!table) throw new TableFailure("TABLE_NOT_FOUND");
      if (table.reservedByTeamId) {
        throw new TableFailure("TABLE_ASSIGNED", {
          tableNumber: table.number,
        });
      }

      await writeReservationAudit(tx, {
        eventId,
        eventName: event.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "table.deleted",
        entityType: "table",
        entityId: table.id,
        details: {
          tableId: table.id,
          tableNumber: table.number,
        },
      });
      await tx.delete(tables).where(eq(tables.id, table.id));
      deletedNumber = table.number;
    });
  } catch (error) {
    return tableActionFailure(error, "delete");
  }

  revalidateReservationEventPaths(eventId);
  return { ok: true, message: `Table ${deletedNumber} deleted.` };
}

export async function setReservationTableCount(input: {
  eventId: string;
  count: number;
  expectedTables: ReservationTableTopology;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = tableCountInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { eventId, count, expectedTables } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTableTopology(tx, eventId);
      const event = await getShareLockedEvent(tx, eventId);
      requireMutableEvent(event);
      const currentTables = await tx
        .select({
          id: tables.id,
          number: tables.number,
          reservedByTeamId: tables.reservedByTeamId,
        })
        .from(tables)
        .where(eq(tables.eventId, eventId))
        .orderBy(asc(tables.id))
        .for("update");
      if (!sameTableTopology(currentTables, expectedTables)) {
        throw new TableFailure("TOPOLOGY_CONFLICT");
      }

      let plan: ReturnType<typeof planTableCountChange>;
      try {
        plan = planTableCountChange(currentTables, count);
      } catch (error) {
        if (error instanceof RangeError) {
          throw new TableFailure("TABLE_NUMBER_LIMIT");
        }
        throw error;
      }
      if (!plan.ok) {
        throw new TableFailure("COUNT_BLOCKED", {
          blockedNumbers: plan.blockedNumbers,
        });
      }

      const addedTables =
        plan.addNumbers.length > 0
          ? await tx
              .insert(tables)
              .values(
                plan.addNumbers.map((number) => ({
                  eventId,
                  number,
                })),
              )
              .returning({ id: tables.id, number: tables.number })
          : [];
      const removedTables = currentTables
        .filter((table) => plan.removeIds.includes(table.id))
        .sort((left, right) => left.number - right.number);
      if (plan.removeIds.length > 0) {
        await tx.delete(tables).where(inArray(tables.id, plan.removeIds));
      }
      addedTables.sort((left, right) => left.number - right.number);
      const afterCount =
        currentTables.length + addedTables.length - removedTables.length;

      await writeReservationAudit(tx, {
        eventId,
        eventName: event.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "table.count_changed",
        entityType: "table",
        entityId: eventId,
        details: {
          beforeCount: currentTables.length,
          afterCount,
          addedTableIds: addedTables.map((table) => table.id),
          addedNumbers: addedTables.map((table) => table.number),
          removedTableIds: removedTables.map((table) => table.id),
          removedNumbers: removedTables.map((table) => table.number),
        },
      });
    });
  } catch (error) {
    return tableActionFailure(error, "set count");
  }

  revalidateReservationEventPaths(eventId);
  return { ok: true, message: `Table count set to ${count}.` };
}

type MoveAssignmentOutcome =
  | {
      kind: "already";
      tableNumber: number;
    }
  | {
      kind: "assigned";
      tableNumber: number;
    }
  | {
      kind: "moved";
      fromTableNumber: number;
      toTableNumber: number;
    }
  | {
      kind: "swapped";
      fromTableNumber: number;
      toTableNumber: number;
    }
  | {
      kind: "displaced";
      tableNumber: number;
    };

export async function moveReservationTeam(input: {
  eventId: string;
  teamId: string;
  tableId: string;
  expectedSourceTableId: string | null;
  expectedSourceTableNumber: number | null;
  expectedDestinationTableNumber: number;
  expectedDestinationTeamId: string | null;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = moveAssignmentInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const {
    eventId,
    teamId,
    tableId,
    expectedSourceTableId,
    expectedSourceTableNumber,
    expectedDestinationTableNumber,
    expectedDestinationTeamId,
  } = parsed.data;
  let outcome: MoveAssignmentOutcome;

  try {
    outcome = await db.transaction(async (tx) => {
      const event = await getShareLockedEvent(tx, eventId);
      requireMutableEvent(event);
      const [team] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.id, teamId))
        .for("no key update")
        .limit(1);
      if (!team) throw new AssignmentFailure("TEAM_NOT_FOUND");

      const lockRelevantTables = () =>
        tx
          .select({
            id: tables.id,
            number: tables.number,
            reservedByTeamId: tables.reservedByTeamId,
          })
          .from(tables)
          .where(
            and(
              eq(tables.eventId, eventId),
              or(eq(tables.id, tableId), eq(tables.reservedByTeamId, teamId)),
            ),
          )
          .orderBy(asc(tables.id))
          .for("update");

      // The first statement acquires table locks. The second takes a fresh
      // READ COMMITTED snapshot so assignments that committed while lock
      // acquisition was blocked are included in confirmation checks.
      await lockRelevantTables();
      const lockedTables = await lockRelevantTables();
      const target = lockedTables.find((table) => table.id === tableId);
      if (!target) throw new AssignmentFailure("TABLE_NOT_FOUND");
      const current = lockedTables.find(
        (table) => table.reservedByTeamId === teamId,
      );
      if (
        (current?.id ?? null) !== expectedSourceTableId ||
        (current?.number ?? null) !== expectedSourceTableNumber ||
        target.number !== expectedDestinationTableNumber ||
        target.reservedByTeamId !== expectedDestinationTeamId
      ) {
        throw new AssignmentFailure("CONFIRMATION_CONFLICT");
      }
      if (current?.id === target.id) {
        return { kind: "already", tableNumber: target.number };
      }

      const displacedTeamId = target.reservedByTeamId;
      const tableIdsToClear = [...new Set([current?.id, target.id])].filter(
        (id): id is string => Boolean(id),
      );
      await tx
        .update(tables)
        .set({ reservedByTeamId: null, reservedAt: null })
        .where(inArray(tables.id, tableIdsToClear));

      const now = new Date();
      await tx
        .update(tables)
        .set({ reservedByTeamId: teamId, reservedAt: now })
        .where(eq(tables.id, target.id));
      if (current && displacedTeamId) {
        await tx
          .update(tables)
          .set({ reservedByTeamId: displacedTeamId, reservedAt: now })
          .where(eq(tables.id, current.id));
      }

      let action:
        | "assignment.assigned"
        | "assignment.moved"
        | "assignment.swapped"
        | "assignment.displaced";
      let details: Record<string, unknown>;
      let completedOutcome: MoveAssignmentOutcome;
      if (current && displacedTeamId) {
        action = "assignment.swapped";
        details = {
          teamId,
          swappedTeamId: displacedTeamId,
          fromTableId: current.id,
          toTableId: target.id,
          teamIds: [teamId, displacedTeamId],
          tableIds: [current.id, target.id],
        };
        completedOutcome = {
          kind: "swapped",
          fromTableNumber: current.number,
          toTableNumber: target.number,
        };
      } else if (current) {
        action = "assignment.moved";
        details = {
          teamId,
          fromTableId: current.id,
          toTableId: target.id,
          teamIds: [teamId],
          tableIds: [current.id, target.id],
        };
        completedOutcome = {
          kind: "moved",
          fromTableNumber: current.number,
          toTableNumber: target.number,
        };
      } else if (displacedTeamId) {
        action = "assignment.displaced";
        details = {
          teamId,
          displacedTeamId,
          tableId: target.id,
          fromTableId: null,
          toTableId: target.id,
          teamIds: [teamId, displacedTeamId],
          tableIds: [target.id],
        };
        completedOutcome = {
          kind: "displaced",
          tableNumber: target.number,
        };
      } else {
        action = "assignment.assigned";
        details = {
          teamId,
          tableId: target.id,
          fromTableId: null,
          toTableId: target.id,
          teamIds: [teamId],
          tableIds: [target.id],
        };
        completedOutcome = {
          kind: "assigned",
          tableNumber: target.number,
        };
      }

      await writeReservationAudit(tx, {
        eventId,
        eventName: event.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action,
        entityType: "assignment",
        entityId: teamId,
        details,
      });
      return completedOutcome;
    });
  } catch (error) {
    return assignmentActionFailure(error, "move");
  }

  if (outcome.kind !== "already") {
    revalidateReservationEventPaths(eventId);
  }
  switch (outcome.kind) {
    case "already":
      return {
        ok: true,
        message: `Team is already at table ${outcome.tableNumber}.`,
      };
    case "assigned":
      return {
        ok: true,
        message: `Assigned team to table ${outcome.tableNumber}.`,
      };
    case "moved":
      return {
        ok: true,
        message: `Moved team from table ${outcome.fromTableNumber} to table ${outcome.toTableNumber}.`,
      };
    case "swapped":
      return {
        ok: true,
        message: `Swapped teams between tables ${outcome.fromTableNumber} and ${outcome.toTableNumber}.`,
      };
    case "displaced":
      return {
        ok: true,
        message: `Moved team to table ${outcome.tableNumber}. Previous occupant was unassigned.`,
      };
  }
}

export async function unassignReservationTeam(input: {
  eventId: string;
  teamId: string;
  expectedSourceTableId: string;
  expectedSourceTableNumber: number;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = unassignAssignmentInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { eventId, teamId, expectedSourceTableId, expectedSourceTableNumber } =
    parsed.data;
  let tableNumber = 0;

  try {
    await db.transaction(async (tx) => {
      const event = await getShareLockedEvent(tx, eventId);
      requireMutableEvent(event);
      const [team] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.id, teamId))
        .for("no key update")
        .limit(1);
      if (!team) throw new AssignmentFailure("TEAM_NOT_FOUND");

      const lockCurrentTable = () =>
        tx
          .select({
            id: tables.id,
            number: tables.number,
          })
          .from(tables)
          .where(
            and(
              eq(tables.eventId, eventId),
              eq(tables.reservedByTeamId, teamId),
            ),
          )
          .orderBy(asc(tables.id))
          .for("update")
          .limit(1);
      await lockCurrentTable();
      const [current] = await lockCurrentTable();
      if (
        !current ||
        current.id !== expectedSourceTableId ||
        current.number !== expectedSourceTableNumber
      ) {
        throw new AssignmentFailure("CONFIRMATION_CONFLICT");
      }

      await tx
        .update(tables)
        .set({ reservedByTeamId: null, reservedAt: null })
        .where(eq(tables.id, current.id));
      await writeReservationAudit(tx, {
        eventId,
        eventName: event.name,
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "assignment.unassigned",
        entityType: "assignment",
        entityId: teamId,
        details: {
          teamId,
          tableId: current.id,
          fromTableId: current.id,
          toTableId: null,
          teamIds: [teamId],
          tableIds: [current.id],
        },
      });
      tableNumber = current.number;
    });
  } catch (error) {
    return assignmentActionFailure(error, "unassign");
  }

  revalidateReservationEventPaths(eventId);
  return {
    ok: true,
    message: `Unassigned team from table ${tableNumber}.`,
  };
}
