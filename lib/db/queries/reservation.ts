import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, tables, teams } from "@/lib/db/schema/reservation";
import { users } from "@/lib/db/schema/users";

export type Event = typeof events.$inferSelect;
export type Team = typeof teams.$inferSelect;

export type TableWithTeam = {
  id: string;
  number: number;
  reservedByTeamId: string | null;
  reservedByTeamName: string | null;
};

export type SignedInUser = {
  id: string;
  name: string;
  teamId: string | null;
  teamName: string | null;
  isAdmin: boolean;
};

const TEMP_SIGNED_IN_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Test User",
} as const;

export function getEvents(): Promise<Event[]> {
  return db
    .select()
    .from(events)
    .orderBy(asc(events.startsAt), asc(events.name));
}

export function getTeams(): Promise<Team[]> {
  return db.select().from(teams).orderBy(asc(teams.name));
}

export async function getSignedInUser(): Promise<SignedInUser | null> {
  const rows = await db
    .select({
      teamId: users.teamId,
      teamName: teams.name,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .leftJoin(teams, eq(users.teamId, teams.id))
    .where(eq(users.id, TEMP_SIGNED_IN_USER.id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: TEMP_SIGNED_IN_USER.id,
    name: TEMP_SIGNED_IN_USER.name,
    teamId: row.teamId,
    teamName: row.teamName,
    isAdmin: row.isAdmin,
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
