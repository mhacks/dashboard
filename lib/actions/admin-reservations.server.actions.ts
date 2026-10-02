"use server";

import { asc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { postgresErrorCode } from "@/lib/db/errors";
import { reservationSettings, tables } from "@/lib/db/schema/reservation";
import { teams } from "@/lib/db/schema/teams";
import { writeReservationAudit } from "@/lib/reservation/audit";
import {
  MAX_RESERVATION_TABLE_NUMBER,
  planTableCountChange,
} from "@/lib/reservation/domain";
import { RESERVATION_SETTINGS_ID } from "@/lib/queries/reservation-settings";
import { revalidateReservationPaths } from "@/lib/reservation/revalidate";
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

const createTableInputSchema = z.object({
  number: reservationTableNumberSchema,
});

const tableMutationInputSchema = createTableInputSchema.extend({
  tableId: reservationIdSchema,
});

const deleteTableInputSchema = z.object({
  tableId: reservationIdSchema,
});

const tableCountInputSchema = z.object({
  count: reservationTableCountSchema,
  expectedTables: reservationTableTopologySchema,
});

const moveAssignmentInputSchema = z
  .object({
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
  teamId: reservationIdSchema,
  expectedSourceTableId: reservationIdSchema,
  expectedSourceTableNumber: reservationTableNumberSchema,
});

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

function knownConstraintFailure(
  error: unknown,
  messages: { unique: string; check: string },
): ReservationActionResult | null {
  switch (postgresErrorCode(error)) {
    case "23505":
      return { ok: false, error: messages.unique };
    case "23514":
      return { ok: false, error: messages.check };
    case "23503":
      return {
        ok: false,
        error: "A related record no longer exists. Refresh and try again.",
      };
    default:
      return null;
  }
}

function tableActionFailure(
  error: unknown,
  operation: TableOperation,
): ReservationActionResult {
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

  const constraintFailure = knownConstraintFailure(error, {
    unique: "That table number is already in use.",
    check: "The table details conflict with database rules.",
  });
  if (constraintFailure) return constraintFailure;

  console.error(`Unable to ${operation} reservation table:`, error);
  return {
    ok: false,
    error: unexpectedTableFailureMessages[operation],
  };
}

function assignmentActionFailure(
  error: unknown,
  operation: AssignmentOperation,
): ReservationActionResult {
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

  const constraintFailure = knownConstraintFailure(error, {
    unique: "That team already has a table for this event.",
    check: "The assignment conflicts with database rules.",
  });
  if (constraintFailure) return constraintFailure;

  console.error(`Unable to ${operation} reservation team:`, error);
  return {
    ok: false,
    error: unexpectedAssignmentFailureMessages[operation],
  };
}

type ReservationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

async function lockReservationTables(tx: ReservationTransaction) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended('reservation', 0))`,
  );
}

function windowTimestamp(value: Date | null) {
  return value ? value.toISOString() : null;
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

export async function setReservationWindow(
  input: ReservationEventInput,
): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = reservationEventInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const now = new Date().toISOString();
  const reservationsOpenAt = windowTimestamp(parsed.data.reservationsOpenAt);
  const reservationsCloseAt = windowTimestamp(parsed.data.reservationsCloseAt);

  try {
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select({
          reservationsOpenAt: reservationSettings.reservationsOpenAt,
          reservationsCloseAt: reservationSettings.reservationsCloseAt,
        })
        .from(reservationSettings)
        .where(eq(reservationSettings.id, RESERVATION_SETTINGS_ID))
        .limit(1);

      await tx
        .insert(reservationSettings)
        .values({
          id: RESERVATION_SETTINGS_ID,
          reservationsOpenAt,
          reservationsCloseAt,
          updatedByUserId: organizer.id,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: reservationSettings.id,
          set: {
            reservationsOpenAt,
            reservationsCloseAt,
            updatedByUserId: organizer.id,
            updatedAt: now,
          },
        });

      await writeReservationAudit(tx, {
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "window.updated",
        entityType: "reservation_settings",
        entityId: null,
        details: {
          beforeOpenAt: before?.reservationsOpenAt ?? null,
          beforeCloseAt: before?.reservationsCloseAt ?? null,
          afterOpenAt: reservationsOpenAt,
          afterCloseAt: reservationsCloseAt,
        },
      });
    });
  } catch (error) {
    const known = knownConstraintFailure(error, {
      unique: "An event with those values already exists.",
      check: "The event details conflict with database rules.",
    });
    if (known) return known;
    console.error("Unable to update reservation window:", error);
    return {
      ok: false,
      error: "Could not update the reservation. Try again.",
    };
  }

  revalidateReservationPaths();
  return { ok: true, message: "Reservation window saved." };
}

export async function createReservationTable(input: {
  number: number;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = createTableInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { number } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTables(tx);
      const [table] = await tx
        .insert(tables)
        .values({ number })
        .returning({ id: tables.id, number: tables.number });
      await writeReservationAudit(tx, {
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

  revalidateReservationPaths();
  return { ok: true, message: `Table ${number} created.` };
}

export async function renumberReservationTable(input: {
  tableId: string;
  number: number;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = tableMutationInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { tableId, number } = parsed.data;
  let previousNumber = number;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTables(tx);
      const lockedTables = await tx
        .select({
          id: tables.id,
          number: tables.number,
        })
        .from(tables)
        .where(or(eq(tables.id, tableId), eq(tables.number, number)))
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

  revalidateReservationPaths();
  return {
    ok: true,
    message: `Table ${previousNumber} renumbered to ${number}.`,
  };
}

export async function deleteReservationTable(input: {
  tableId: string;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = deleteTableInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { tableId } = parsed.data;
  let deletedNumber = 0;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTables(tx);
      const [table] = await tx
        .select({
          id: tables.id,
          number: tables.number,
          reservedByTeamId: tables.reservedByTeamId,
        })
        .from(tables)
        .where(eq(tables.id, tableId))
        .for("update")
        .limit(1);
      if (!table) throw new TableFailure("TABLE_NOT_FOUND");
      if (table.reservedByTeamId) {
        throw new TableFailure("TABLE_ASSIGNED", {
          tableNumber: table.number,
        });
      }

      await writeReservationAudit(tx, {
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

  revalidateReservationPaths();
  return { ok: true, message: `Table ${deletedNumber} deleted.` };
}

export async function setReservationTableCount(input: {
  count: number;
  expectedTables: ReservationTableTopology;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = tableCountInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { count, expectedTables } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTables(tx);
      const currentTables = await tx
        .select({
          id: tables.id,
          number: tables.number,
          reservedByTeamId: tables.reservedByTeamId,
        })
        .from(tables)
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
        actorUserId: organizer.id,
        actorEmail: organizer.email,
        action: "table.count_changed",
        entityType: "table",
        entityId: null,
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

  revalidateReservationPaths();
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
      await lockReservationTables(tx);
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
            or(eq(tables.id, tableId), eq(tables.reservedByTeamId, teamId)),
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
    revalidateReservationPaths();
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
  teamId: string;
  expectedSourceTableId: string;
  expectedSourceTableNumber: number;
}): Promise<ReservationActionResult> {
  const organizer = await requireOrganizer();
  const parsed = unassignAssignmentInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { teamId, expectedSourceTableId, expectedSourceTableNumber } =
    parsed.data;
  let tableNumber = 0;

  try {
    await db.transaction(async (tx) => {
      await lockReservationTables(tx);
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
          .where(eq(tables.reservedByTeamId, teamId))
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

  revalidateReservationPaths();
  return {
    ok: true,
    message: `Unassigned team from table ${tableNumber}.`,
  };
}
