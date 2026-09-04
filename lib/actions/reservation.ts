"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { events, tables } from "@/lib/db/schema/reservation";
import type { UserEntry } from "@/lib/db/schema/users";
import {
  ACCEPTED_RESERVATION_ERROR,
  lockAcceptedReservationApplicant,
  ReservationAccessError,
} from "@/lib/reservation/access";
import { writeReservationAudit } from "@/lib/reservation/audit";
import { getReservationAvailability } from "@/lib/reservation/domain";
import { reservationIdSchema } from "@/lib/reservation/validation";

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

type ParticipantReservationAuth = {
  ok: true;
  teamId: string;
  user: UserEntry;
};

type ReservationFailureCode =
  | "EVENT_NOT_FOUND"
  | "RESERVATIONS_UNAVAILABLE"
  | "TABLE_NOT_FOUND"
  | "TABLE_TAKEN"
  | "TEAM_ALREADY_RESERVED"
  | "FULL";

const reservationFailureMessages: Record<ReservationFailureCode, string> = {
  EVENT_NOT_FOUND: "That event no longer exists.",
  RESERVATIONS_UNAVAILABLE: "Reservations are not open for this event.",
  TABLE_NOT_FOUND: "That table no longer exists.",
  TABLE_TAKEN: "That table was just taken. Pick another.",
  TEAM_ALREADY_RESERVED: "Your team already has a table for this event.",
  FULL: "No open tables left for this event.",
};

class ReservationFailure extends Error {
  constructor(readonly code: ReservationFailureCode) {
    super(code);
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function requireTeamId(): Promise<
  ParticipantReservationAuth | { ok: false; error: string }
> {
  const user = await requireSessionUser();
  if (user.role === "organizer") {
    return { ok: false, error: "Organizers cannot reserve tables." };
  }
  if (!user.teamId) {
    return { ok: false, error: "You're not on a team yet." };
  }
  return { ok: true, teamId: user.teamId, user };
}

function revalidateReservationPaths(eventId: string) {
  revalidatePath("/reserve");
  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${eventId}/assignments`);
  revalidatePath(`/admin/reservations/${eventId}/audit`);
}

function isPostgresErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function knownReservationFailure(error: unknown): ActionResult | null {
  if (error instanceof ReservationAccessError) {
    return { ok: false, error: ACCEPTED_RESERVATION_ERROR };
  }
  if (error instanceof ReservationFailure) {
    return {
      ok: false,
      error: reservationFailureMessages[error.code],
    };
  }
  if (isPostgresErrorCode(error, "23505")) {
    return {
      ok: false,
      error: reservationFailureMessages.TEAM_ALREADY_RESERVED,
    };
  }
  return null;
}

export async function reserveTable({
  tableId,
}: {
  tableId: string;
}): Promise<ActionResult> {
  const auth = await requireTeamId();
  if (!auth.ok) return auth;
  const { teamId, user } = auth;
  const parsedTableId = reservationIdSchema.safeParse(tableId);
  if (!parsedTableId.success) {
    return { ok: false, error: "Select a valid table and try again." };
  }
  const selectedTableId = parsedTableId.data;

  let assignment: { eventId: string; tableNumber: number };
  try {
    assignment = await db.transaction(async (tx) => {
      await lockAcceptedReservationApplicant(tx, user.id);
      // Share-lock the event before checking availability. Participant claims
      // can proceed together, while organizer lifecycle updates must wait.
      const [target] = await tx
        .select({
          id: tables.id,
          eventId: tables.eventId,
          number: tables.number,
          eventName: events.name,
          eventStatus: events.status,
          reservationsOpenAt: events.reservationsOpenAt,
          reservationsCloseAt: events.reservationsCloseAt,
        })
        .from(events)
        .innerJoin(tables, eq(tables.eventId, events.id))
        .where(eq(tables.id, selectedTableId))
        .for("share", { of: events })
        .limit(1);

      if (!target) {
        throw new ReservationFailure("TABLE_NOT_FOUND");
      }
      if (
        !getReservationAvailability({
          status: target.eventStatus,
          reservationsOpenAt: target.reservationsOpenAt,
          reservationsCloseAt: target.reservationsCloseAt,
        }).canReserve
      ) {
        throw new ReservationFailure("RESERVATIONS_UNAVAILABLE");
      }

      const [existing] = await tx
        .select({ id: tables.id })
        .from(tables)
        .where(
          and(
            eq(tables.eventId, target.eventId),
            eq(tables.reservedByTeamId, teamId),
          ),
        )
        .limit(1);
      if (existing) {
        throw new ReservationFailure("TEAM_ALREADY_RESERVED");
      }

      const claimed = await tx
        .update(tables)
        .set({ reservedByTeamId: teamId, reservedAt: new Date() })
        .where(
          and(eq(tables.id, selectedTableId), isNull(tables.reservedByTeamId)),
        )
        .returning({ id: tables.id });
      if (claimed.length === 0) {
        throw new ReservationFailure("TABLE_TAKEN");
      }

      await writeReservationAudit(tx, {
        eventId: target.eventId,
        eventName: target.eventName,
        actorUserId: user.id,
        actorEmail: user.email,
        action: "assignment.reserved",
        entityType: "assignment",
        entityId: target.id,
        details: {
          tableId: target.id,
          tableNumber: target.number,
          teamId,
        },
      });

      return {
        eventId: target.eventId,
        tableNumber: target.number,
      };
    });
  } catch (error) {
    const known = knownReservationFailure(error);
    if (known) return known;
    console.error("Unable to reserve participant table:", error);
    return {
      ok: false,
      error: "Could not reserve that table. Try again.",
    };
  }

  revalidateReservationPaths(assignment.eventId);
  return {
    ok: true,
    message: `Reserved table ${assignment.tableNumber}.`,
  };
}

export async function randomlyAssignTable({
  eventId,
}: {
  eventId: string;
}): Promise<ActionResult> {
  const auth = await requireTeamId();
  if (!auth.ok) return auth;
  const { teamId, user } = auth;
  const parsedEventId = reservationIdSchema.safeParse(eventId);
  if (!parsedEventId.success) {
    return { ok: false, error: "Select a valid event and try again." };
  }
  const selectedEventId = parsedEventId.data;

  let assigned: { eventId: string; tableNumber: number };
  try {
    assigned = await db.transaction(async (tx) => {
      await lockAcceptedReservationApplicant(tx, user.id);
      // Keep the shared event-before-table lock order used by direct claims.
      const [event] = await tx
        .select({
          id: events.id,
          name: events.name,
          status: events.status,
          reservationsOpenAt: events.reservationsOpenAt,
          reservationsCloseAt: events.reservationsCloseAt,
        })
        .from(events)
        .where(eq(events.id, selectedEventId))
        .for("share")
        .limit(1);
      if (!event) {
        throw new ReservationFailure("EVENT_NOT_FOUND");
      }
      if (!getReservationAvailability(event).canReserve) {
        throw new ReservationFailure("RESERVATIONS_UNAVAILABLE");
      }

      const [existing] = await tx
        .select({ id: tables.id })
        .from(tables)
        .where(
          and(
            eq(tables.eventId, selectedEventId),
            eq(tables.reservedByTeamId, teamId),
          ),
        )
        .limit(1);
      if (existing) {
        throw new ReservationFailure("TEAM_ALREADY_RESERVED");
      }

      const open = await tx
        .select({ id: tables.id, number: tables.number })
        .from(tables)
        .where(
          and(
            eq(tables.eventId, selectedEventId),
            isNull(tables.reservedByTeamId),
          ),
        );

      if (open.length === 0) {
        throw new ReservationFailure("FULL");
      }

      for (const candidate of shuffle(open)) {
        const claimed = await tx
          .update(tables)
          .set({ reservedByTeamId: teamId, reservedAt: new Date() })
          .where(
            and(eq(tables.id, candidate.id), isNull(tables.reservedByTeamId)),
          )
          .returning({ id: tables.id });

        if (claimed.length > 0) {
          await writeReservationAudit(tx, {
            eventId: event.id,
            eventName: event.name,
            actorUserId: user.id,
            actorEmail: user.email,
            action: "assignment.randomly_reserved",
            entityType: "assignment",
            entityId: candidate.id,
            details: {
              tableId: candidate.id,
              tableNumber: candidate.number,
              teamId,
            },
          });
          return {
            eventId: event.id,
            tableNumber: candidate.number,
          };
        }
      }

      throw new ReservationFailure("FULL");
    });
  } catch (error) {
    const known = knownReservationFailure(error);
    if (known) return known;
    console.error("Unable to randomly assign participant table:", error);
    return {
      ok: false,
      error: "Could not assign a table. Try again.",
    };
  }

  revalidateReservationPaths(assigned.eventId);
  return { ok: true, message: `Assigned table ${assigned.tableNumber}.` };
}
