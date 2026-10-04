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
  const mapping = tableMapping(await getSubmittedTeams());
  const result = await putTables(mapping);
  lastSent = { key: mappingKey(mapping), at: Date.now() };
  return { stored: result.stored, unknownUrls: result.unknown_urls };
}

// MDredd draws only projects with a table, so its mapping has to follow
// assignments as they change. Judges' pair requests resend it when it
// differs from what this server last sent, or that was over a minute ago
// (MDredd may have restarted or been archived since).
const RESEND_AFTER_MS = 60_000;
let lastSent: { key: string; at: number } | null = null;

function mappingKey(mapping: Record<string, number>): string {
  return JSON.stringify(
    Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** Resends the mapping if it changed. A failure leaves MDredd's last copy. */
export async function syncTablesIfStale(rows: JudgingTeam[]): Promise<void> {
  const mapping = tableMapping(rows);
  const key = mappingKey(mapping);
  if (
    lastSent &&
    lastSent.key === key &&
    Date.now() - lastSent.at < RESEND_AFTER_MS
  ) {
    return;
  }
  try {
    await putTables(mapping);
    lastSent = { key, at: Date.now() };
  } catch (error) {
    console.error("[judging] table sync before pair failed:", error);
  }
}
