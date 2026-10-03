import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema/reservation";
import { teamSubmissions, teams } from "@/lib/db/schema/teams";
import { putTables } from "@/lib/judging/mdredd";
import { normalizeDevpostUrl } from "@/lib/judging/url";

export type JudgingTeam = {
  teamId: string;
  teamName: string;
  devpostUrl: string;
  tableId: string | null;
  tableNumber: number | null;
};

/** Every team that saved a Devpost link, with the table it reserved, if any. */
export async function getSubmittedTeams(): Promise<JudgingTeam[]> {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      devpostUrl: teamSubmissions.devpostUrl,
      tableId: tables.id,
      tableNumber: tables.number,
    })
    .from(teamSubmissions)
    .innerJoin(teams, eq(teamSubmissions.teamId, teams.id))
    .leftJoin(tables, eq(tables.reservedByTeamId, teams.id));
}

/** Teams keyed by normalized Devpost link, for matching MDredd's project URLs. */
export function teamsByUrl(rows: JudgingTeam[]): Map<string, JudgingTeam> {
  return new Map(rows.map((row) => [normalizeDevpostUrl(row.devpostUrl), row]));
}

/** The body of MDredd's PUT /tables: each seated team's link → its table number. */
export function tableMapping(rows: JudgingTeam[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  for (const row of rows) {
    if (row.tableNumber !== null) mapping[row.devpostUrl] = row.tableNumber;
  }
  return mapping;
}

export type TableSyncResult = {
  stored: number;
  /** Team links that match no uploaded project. */
  unknownUrls: string[];
};

/**
 * Sends every seated team's Devpost link and table number to MDredd, replacing
 * what it had. MDredd uses it for the Table Number column of its export.
 * Callers check the organizer role.
 */
export async function syncTablesToMdredd(): Promise<TableSyncResult> {
  const result = await putTables(tableMapping(await getSubmittedTeams()));
  return { stored: result.stored, unknownUrls: result.unknown_urls };
}
