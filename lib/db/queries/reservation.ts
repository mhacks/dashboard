import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema/reservation";
import { teams } from "@/lib/db/schema/teams";
import {
  DEFAULT_MAP_COLUMNS,
  DEFAULT_MAP_ROWS,
  getReservationAvailability,
} from "@/lib/reservation/domain";
import { getJudgingSettings } from "@/lib/queries/judging-settings";
import type { TableWithTeam } from "@/lib/reservation/types";

type ReservationQueryClient = Pick<typeof db, "select">;

export function selectTablesWithTeam(executor: ReservationQueryClient) {
  return executor
    .select({
      id: tables.id,
      number: tables.number,
      originX: tables.originX,
      originY: tables.originY,
      width: tables.width,
      height: tables.height,
      reservedByTeamId: tables.reservedByTeamId,
      reservedByTeamName: teams.name,
    })
    .from(tables)
    .leftJoin(teams, eq(tables.reservedByTeamId, teams.id))
    .orderBy(asc(tables.number), asc(tables.id));
}

export type ParticipantReservationSnapshot = {
  state: "open" | "scheduled" | "closed";
  columns: number;
  rows: number;
  tables: TableWithTeam[];
};

export async function getParticipantReservationSnapshot(): Promise<ParticipantReservationSnapshot> {
  const [settings, reservationTables] = await Promise.all([
    getJudgingSettings(),
    selectTablesWithTeam(db),
  ]);
  const availability = getReservationAvailability(settings ?? {});
  return {
    state: availability.state,
    columns: settings?.mapColumns ?? DEFAULT_MAP_COLUMNS,
    rows: settings?.mapRows ?? DEFAULT_MAP_ROWS,
    tables: reservationTables,
  };
}
