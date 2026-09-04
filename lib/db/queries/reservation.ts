import { asc, eq, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  events,
  tables,
  teams,
  type Event as ReservationEventRow,
} from "@/lib/db/schema/reservation";
import { users } from "@/lib/db/schema/users";
import { getReservationAvailability } from "@/lib/reservation/domain";
import type {
  ParticipantEvent,
  ParticipantReservationUser,
  TableWithTeam,
} from "@/lib/reservation/types";

export function toParticipantEvent(
  event: ReservationEventRow,
): ParticipantEvent {
  if (event.status !== "open" && event.status !== "closed") {
    throw new Error("Participant events must be open or closed.");
  }

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
    .from(events)
    .where(inArray(events.status, ["open", "closed"]))
    .orderBy(asc(events.startsAt), asc(events.name));

  return rows.map(toParticipantEvent);
}

export async function getParticipantReservationUser(): Promise<ParticipantReservationUser | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      teamId: users.teamId,
      teamName: teams.name,
      role: users.role,
    })
    .from(users)
    .leftJoin(teams, eq(users.teamId, teams.id))
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!row) return null;
  return row;
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
