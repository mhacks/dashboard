import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema/reservation";
import { teamSubmissions, teams } from "@/lib/db/schema/teams";
import type { SubmissionJoin } from "./enrich";

export async function listSubmissionJoins(): Promise<SubmissionJoin[]> {
  const rows = await db
    .select({
      devpostUrl: teamSubmissions.devpostUrl,
      teamId: teams.id,
      teamName: teams.name,
      tableNumber: tables.number,
    })
    .from(teamSubmissions)
    .innerJoin(teams, eq(teamSubmissions.teamId, teams.id))
    .leftJoin(tables, eq(tables.reservedByTeamId, teams.id));

  return rows;
}
