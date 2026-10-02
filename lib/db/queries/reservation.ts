import { asc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema/reservation";
import { teams } from "@/lib/db/schema/teams";
import { getParticipantTeam } from "@/lib/reservation/access";
import { getReservationAvailability } from "@/lib/reservation/domain";
import { getReservationSettings } from "@/lib/queries/reservation-settings";
import type {
  ParticipantReservationUser,
  TableWithTeam,
} from "@/lib/reservation/types";

export async function getParticipantReservationUser(): Promise<ParticipantReservationUser | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const team = await getParticipantTeam(sessionUser.id);
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    role: sessionUser.role,
    teamId: team?.teamId ?? null,
    teamName: team?.teamName ?? null,
  };
}

export type ParticipantReservationSnapshot = {
  state: "open" | "scheduled" | "closed";
  tables: TableWithTeam[];
};

export async function getParticipantReservationSnapshot(): Promise<ParticipantReservationSnapshot> {
  const [settings, reservationTables] = await Promise.all([
    getReservationSettings(),
    getTables(),
  ]);
  const availability = getReservationAvailability(settings ?? {});
  return { state: availability.state, tables: reservationTables };
}

export function getTables(): Promise<TableWithTeam[]> {
  return db
    .select({
      id: tables.id,
      number: tables.number,
      reservedByTeamId: tables.reservedByTeamId,
      reservedByTeamName: teams.name,
    })
    .from(tables)
    .leftJoin(teams, eq(tables.reservedByTeamId, teams.id))
    .orderBy(asc(tables.number));
}
