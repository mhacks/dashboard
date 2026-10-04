"use server";

import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { judgingSettings, tables } from "@/lib/db/schema/reservation";
import { submissionSettings, teamSubmissions } from "@/lib/db/schema/teams";
import type { UserEntry } from "@/lib/db/schema/users";
import {
  CHECKED_IN_RESERVATION_ERROR,
  getParticipantTeam,
  lockAcceptedReservationApplicant,
  ReservationAccessError,
} from "@/lib/reservation/access";
import { writeReservationAudit } from "@/lib/reservation/audit";
import {
  getReservationAvailability,
  getWindowAvailability,
} from "@/lib/reservation/domain";
import { JUDGING_SETTINGS_ID } from "@/lib/queries/judging-settings";
import { SUBMISSION_SETTINGS_ID } from "@/lib/queries/submission-settings";
import { revalidateReservationPaths } from "@/lib/reservation/revalidate";
import { reservationIdSchema } from "@/lib/reservation/validation";
import { devpostUrlSchema } from "@/lib/types/teams";

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

type ParticipantReservationAuth = {
  ok: true;
  teamId: string;
  user: UserEntry;
};

type ReservationFailureCode =
  | "RESERVATIONS_UNAVAILABLE"
  | "TABLE_NOT_FOUND"
  | "TABLE_TAKEN"
  | "TEAM_ALREADY_RESERVED"
  | "FULL"
  | "SUBMISSION_LOCKED";

const reservationFailureMessages: Record<ReservationFailureCode, string> = {
  RESERVATIONS_UNAVAILABLE: "Reservations are not open for this event.",
  TABLE_NOT_FOUND: "That table no longer exists.",
  TABLE_TAKEN: "That table was just taken. Pick another.",
  TEAM_ALREADY_RESERVED: "Your team already has a table for this event.",
  FULL: "No open tables left for this event.",
  SUBMISSION_LOCKED:
    "Project submissions are closed, so your Devpost link can't be changed.",
};

class ReservationFailure extends Error {
  constructor(readonly code: ReservationFailureCode) {
    super(code);
  }
}

async function requireTeamId(): Promise<
  ParticipantReservationAuth | { ok: false; error: string }
> {
  const user = await requireSessionUser();
  if (user.role === "organizer") {
    return { ok: false, error: "Organizers cannot reserve tables." };
  }
  const team = await getParticipantTeam(user.id);
  if (!team) {
    return { ok: false, error: "You're not on a team yet." };
  }
  return { ok: true, teamId: team.teamId, user };
}

type ReservationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

async function lockOpenJudgingSettings(tx: ReservationTransaction) {
  // Share-lock the settings row before checking the window. Participant
  // claims can proceed together; an organizer window update must wait.
  const [settings] = await tx
    .select({
      reservationsOpenAt: judgingSettings.reservationsOpenAt,
      reservationsCloseAt: judgingSettings.reservationsCloseAt,
    })
    .from(judgingSettings)
    .where(eq(judgingSettings.id, JUDGING_SETTINGS_ID))
    .for("share")
    .limit(1);
  if (!settings || getReservationAvailability(settings).state !== "open") {
    throw new ReservationFailure("RESERVATIONS_UNAVAILABLE");
  }
}

function parseDevpostUrl(
  devpostUrl: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const parsed = devpostUrlSchema.safeParse(devpostUrl);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a Devpost link",
    };
  }
  return { ok: true, url: parsed.data };
}

// A table is reserved together with the team's Devpost link. A first link
// is saved even outside the submission window, since reserving requires it;
// changing an existing link still follows that window.
async function saveReservationDevpostUrl(
  tx: ReservationTransaction,
  teamId: string,
  userId: string,
  devpostUrl: string,
) {
  const [existing] = await tx
    .select({ devpostUrl: teamSubmissions.devpostUrl })
    .from(teamSubmissions)
    .where(eq(teamSubmissions.teamId, teamId))
    .for("update")
    .limit(1);
  if (existing?.devpostUrl === devpostUrl) return;
  if (existing) {
    const [settings] = await tx
      .select({
        opensAt: submissionSettings.opensAt,
        closesAt: submissionSettings.closesAt,
      })
      .from(submissionSettings)
      .where(eq(submissionSettings.id, SUBMISSION_SETTINGS_ID))
      .for("share")
      .limit(1);
    if (
      getWindowAvailability({
        opensAt: settings?.opensAt,
        closesAt: settings?.closesAt,
      }).state !== "open"
    ) {
      throw new ReservationFailure("SUBMISSION_LOCKED");
    }
  }

  const now = new Date().toISOString();
  await tx
    .insert(teamSubmissions)
    .values({
      teamId,
      devpostUrl,
      submittedByUserId: userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: teamSubmissions.teamId,
      set: { devpostUrl, submittedByUserId: userId, updatedAt: now },
    });
}

function knownReservationFailure(error: unknown): ActionResult | null {
  if (error instanceof ReservationAccessError) {
    return { ok: false, error: CHECKED_IN_RESERVATION_ERROR };
  }
  if (error instanceof ReservationFailure) {
    return {
      ok: false,
      error: reservationFailureMessages[error.code],
    };
  }
  if (isUniqueViolation(error)) {
    return {
      ok: false,
      error: reservationFailureMessages.TEAM_ALREADY_RESERVED,
    };
  }
  return null;
}

export async function reserveTable({
  tableId,
  devpostUrl,
}: {
  tableId: string;
  devpostUrl: string;
}): Promise<ActionResult> {
  const auth = await requireTeamId();
  if (!auth.ok) return auth;
  const { teamId, user } = auth;
  const parsedTableId = reservationIdSchema.safeParse(tableId);
  if (!parsedTableId.success) {
    return { ok: false, error: "Select a valid table and try again." };
  }
  const selectedTableId = parsedTableId.data;
  const parsedUrl = parseDevpostUrl(devpostUrl);
  if (!parsedUrl.ok) return parsedUrl;

  let assignment: {
    tableNumber: number;
    fromTableNumber: number | null;
    unchanged: boolean;
  };
  try {
    assignment = await db.transaction(async (tx) => {
      await lockAcceptedReservationApplicant(tx, user.id);
      await lockOpenJudgingSettings(tx);
      await saveReservationDevpostUrl(tx, teamId, user.id, parsedUrl.url);

      // Lock the destination and the team's current table together, in id
      // order, so two moves cannot claim the same open table.
      const lockedTables = await tx
        .select({
          id: tables.id,
          number: tables.number,
          reservedByTeamId: tables.reservedByTeamId,
        })
        .from(tables)
        .where(
          or(
            eq(tables.id, selectedTableId),
            eq(tables.reservedByTeamId, teamId),
          ),
        )
        .orderBy(asc(tables.id))
        .for("update");
      const destination = lockedTables.find(
        (table) => table.id === selectedTableId,
      );
      if (!destination) {
        throw new ReservationFailure("TABLE_NOT_FOUND");
      }
      const current = lockedTables.find(
        (table) => table.reservedByTeamId === teamId,
      );
      if (current?.id === destination.id) {
        return {
          tableNumber: destination.number,
          fromTableNumber: null,
          unchanged: true,
        };
      }
      if (
        destination.reservedByTeamId &&
        destination.reservedByTeamId !== teamId
      ) {
        throw new ReservationFailure("TABLE_TAKEN");
      }

      const now = new Date();
      if (current) {
        await tx
          .update(tables)
          .set({ reservedByTeamId: null, reservedAt: null })
          .where(eq(tables.id, current.id));
      }

      const claimed = await tx
        .update(tables)
        .set({ reservedByTeamId: teamId, reservedAt: now })
        .where(
          and(eq(tables.id, destination.id), isNull(tables.reservedByTeamId)),
        )
        .returning({ id: tables.id });
      if (claimed.length === 0) {
        throw new ReservationFailure("TABLE_TAKEN");
      }

      await writeReservationAudit(tx, {
        actorUserId: user.id,
        actorEmail: user.email,
        action: current ? "assignment.moved" : "assignment.reserved",
        entityType: "assignment",
        entityId: destination.id,
        details: current
          ? {
              teamId,
              fromTableId: current.id,
              toTableId: destination.id,
              fromTableNumber: current.number,
              tableNumber: destination.number,
              teamIds: [teamId],
              tableIds: [current.id, destination.id],
            }
          : {
              tableId: destination.id,
              tableNumber: destination.number,
              teamId,
            },
      });

      return {
        tableNumber: destination.number,
        fromTableNumber: current?.number ?? null,
        unchanged: false,
      };
    });
  } catch (error) {
    const known = knownReservationFailure(error);
    if (known) return known;
    console.error("Unable to reserve participant table:", error);
    return {
      ok: false,
      error: "Could not update that table. Try again.",
    };
  }

  if (assignment.unchanged) {
    return {
      ok: true,
      message: `Your team is already at table ${assignment.tableNumber}.`,
    };
  }

  revalidateReservationPaths();
  return {
    ok: true,
    message:
      assignment.fromTableNumber === null
        ? `Reserved table ${assignment.tableNumber}.`
        : `Moved from table ${assignment.fromTableNumber} to table ${assignment.tableNumber}.`,
  };
}

export async function randomlyAssignTable({
  devpostUrl,
}: {
  devpostUrl: string;
}): Promise<ActionResult> {
  const auth = await requireTeamId();
  if (!auth.ok) return auth;
  const { teamId, user } = auth;
  const parsedUrl = parseDevpostUrl(devpostUrl);
  if (!parsedUrl.ok) return parsedUrl;

  let assigned: { tableNumber: number };
  try {
    assigned = await db.transaction(async (tx) => {
      await lockAcceptedReservationApplicant(tx, user.id);
      await lockOpenJudgingSettings(tx);

      const [existing] = await tx
        .select({ id: tables.id })
        .from(tables)
        .where(eq(tables.reservedByTeamId, teamId))
        .limit(1);
      if (existing) {
        throw new ReservationFailure("TEAM_ALREADY_RESERVED");
      }
      await saveReservationDevpostUrl(tx, teamId, user.id, parsedUrl.url);

      const [candidate] = await tx
        .select({ id: tables.id, number: tables.number })
        .from(tables)
        .where(isNull(tables.reservedByTeamId))
        .orderBy(sql`random()`)
        .limit(1)
        .for("update", { skipLocked: true });

      if (!candidate) {
        throw new ReservationFailure("FULL");
      }

      const claimed = await tx
        .update(tables)
        .set({ reservedByTeamId: teamId, reservedAt: new Date() })
        .where(
          and(eq(tables.id, candidate.id), isNull(tables.reservedByTeamId)),
        )
        .returning({ id: tables.id });

      if (claimed.length === 0) {
        throw new ReservationFailure("FULL");
      }

      await writeReservationAudit(tx, {
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
        tableNumber: candidate.number,
      };
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

  revalidateReservationPaths();
  return { ok: true, message: `Assigned table ${assigned.tableNumber}.` };
}
