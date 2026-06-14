"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { getSignedInUser } from "@/lib/db/queries/reservation";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function requireTeamId(): Promise<
  { ok: true; teamId: string } | { ok: false; error: string }
> {
  const user = await getSignedInUser();
  if (!user) {
    return { ok: false, error: "Signed-in user not found. Run pnpm db:seed." };
  }
  return { ok: true, teamId: user.teamId };
}

async function teamAlreadyReserved(
  eventId: string,
  teamId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: tables.id })
    .from(tables)
    .where(
      and(eq(tables.eventId, eventId), eq(tables.reservedByTeamId, teamId)),
    )
    .limit(1);
  return existing.length > 0;
}

export async function reserveTable({
  tableId,
}: {
  tableId: string;
}): Promise<ActionResult> {
  const auth = await requireTeamId();
  if (!auth.ok) return auth;
  const { teamId } = auth;

  const target = await db
    .select({ id: tables.id, eventId: tables.eventId, number: tables.number })
    .from(tables)
    .where(eq(tables.id, tableId))
    .limit(1);

  if (target.length === 0) {
    return { ok: false, error: "That table no longer exists." };
  }

  const { eventId, number } = target[0];

  if (await teamAlreadyReserved(eventId, teamId)) {
    return {
      ok: false,
      error: "Your team already has a table for this event.",
    };
  }

  const claimed = await db
    .update(tables)
    .set({ reservedByTeamId: teamId, reservedAt: new Date() })
    .where(and(eq(tables.id, tableId), isNull(tables.reservedByTeamId)))
    .returning({ id: tables.id });

  if (claimed.length === 0) {
    return { ok: false, error: "That table was just taken. Pick another." };
  }

  revalidatePath("/reserve");
  return { ok: true, message: `Reserved table ${number}.` };
}

export async function randomlyAssignTable({
  eventId,
}: {
  eventId: string;
}): Promise<ActionResult> {
  const auth = await requireTeamId();
  if (!auth.ok) return auth;
  const { teamId } = auth;

  if (await teamAlreadyReserved(eventId, teamId)) {
    return {
      ok: false,
      error: "Your team already has a table for this event.",
    };
  }

  try {
    const assignedNumber = await db.transaction(async (tx) => {
      const open = await tx
        .select({ id: tables.id, number: tables.number })
        .from(tables)
        .where(
          and(eq(tables.eventId, eventId), isNull(tables.reservedByTeamId)),
        );

      if (open.length === 0) {
        throw new Error("FULL");
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
          return candidate.number;
        }
      }

      throw new Error("FULL");
    });

    revalidatePath("/reserve");
    return { ok: true, message: `Assigned table ${assignedNumber}.` };
  } catch (err) {
    if (err instanceof Error && err.message === "FULL") {
      return { ok: false, error: "No open tables left for this event." };
    }
    return { ok: false, error: "Could not assign a table. Try again." };
  }
}
