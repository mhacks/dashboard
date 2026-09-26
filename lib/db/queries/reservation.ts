import { asc, eq, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  reservationEvents,
  tables,
  type ReservationEvent,
} from "@/lib/db/schema/reservation";
import { teams } from "@/lib/db/schema/teams";
import { getParticipantTeam } from "@/lib/reservation/access";
import { getReservationAvailability } from "@/lib/reservation/domain";
import type {
  ParticipantEvent,
  ParticipantReservationUser,
  TableWithTeam,
} from "@/lib/reservation/types";

export function toParticipantEvent(
  event: Pick<
    ReservationEvent,
    | "id"
    | "name"
    | "description"
    | "startsAt"
    | "location"
    | "status"
    | "reservationsOpenAt"
    | "reservationsCloseAt"
  >,
): ParticipantEvent {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    startsAt: event.startsAt,
    location: event.location,
    status: event.status,
    reservationsOpenAt: event.reservationsOpenAt,
    reservationsCloseAt: event.reservationsCloseAt,
    availability: getReservationAvailability(event),
  };
}

export async function getParticipantEvents(): Promise<ParticipantEvent[]> {
  const rows = await db
    .select()
    .from(reservationEvents)
    .where(inArray(reservationEvents.status, ["open", "closed"]))
    .orderBy(asc(reservationEvents.startsAt), asc(reservationEvents.name));

  return rows.map(toParticipantEvent);
}

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

export function getTablesForEvent(eventId: string): Promise<TableWithTeam[]> {
  return db
    .select({
      id: tables.id,
      number: tables.number,
      reservedByTeamId: tables.reservedByTeamId,
      reservedByTeamName: teams.name,
    })
    .from(tables)
    .leftJoin(teams, eq(tables.reservedByTeamId, teams.id))
    .where(eq(tables.eventId, eventId))
    .orderBy(asc(tables.number));
}
