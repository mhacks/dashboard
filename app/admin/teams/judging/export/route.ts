import { requireOrganizer } from "@/lib/auth/guards";
import { getExportCsv, getPool, getRankings } from "@/lib/judging/mdredd";
import {
  getSubmittedTeams,
  syncTablesToMdredd,
  teamsByUrl,
} from "@/lib/judging/teams";
import { projectTracks } from "@/lib/judging/tracks";
import { normalizeDevpostUrl } from "@/lib/judging/url";
import { serializeCsv, type CsvColumn } from "@/lib/rsvp/csv";

export const dynamic = "force-dynamic";

/**
 * MDredd's project export with the Table Number column. Tables are synced
 * first, when the rate limit allows, so the column reflects current assignments.
 *
 * With `?track=`, only that track's projects, strongest first.
 */
export async function GET(request: Request) {
  try {
    await requireOrganizer();
  } catch {
    return new Response("Only organizers can export projects.", {
      status: 403,
    });
  }

  const track = new URL(request.url).searchParams.get("track")?.trim();
  if (track) return exportTrack(track);

  try {
    await syncTablesToMdredd();
  } catch (error) {
    // Usually MDredd's admin rate limit. The export still has the last synced tables.
    console.error("[judging] table sync before export failed:", error);
  }
  try {
    const csv = await getExportCsv();
    return csvResponse(csv, "judging-projects.csv");
  } catch (error) {
    console.error("[judging] export failed:", error);
    return new Response("Could not export projects from the judging server.", {
      status: 502,
    });
  }
}

type TrackRow = {
  trackRank: number;
  overallRank: number | null;
  id: number;
  attributes: Record<string, string>;
  teamName: string | null;
  tableNumber: number | null;
  removed: boolean;
};

/**
 * One track's projects, built from MDredd's pool rather than its export so
 * rows carry their rank. Tables come straight from the dashboard's teams.
 */
async function exportTrack(track: string) {
  try {
    const [pool, rankings, submittedTeams] = await Promise.all([
      getPool(),
      getRankings(),
      getSubmittedTeams(),
    ]);
    const byUrl = teamsByUrl(submittedTeams);
    const rankOf = new Map(rankings.map((row, index) => [row.id, index + 1]));

    const inTrack = pool
      .filter((entry) => projectTracks(entry.attributes).includes(track))
      .map((entry) => ({ entry, overallRank: rankOf.get(entry.id) ?? null }))
      .sort(
        (a, b) =>
          (a.overallRank ?? Infinity) - (b.overallRank ?? Infinity) ||
          a.entry.id - b.entry.id,
      );
    if (inTrack.length === 0) {
      return new Response(`No projects entered ${track}.`, { status: 404 });
    }

    const rows: TrackRow[] = inTrack.map(({ entry, overallRank }, index) => {
      const url = entry.attributes["Project Url"] ?? "";
      const team = url ? byUrl.get(normalizeDevpostUrl(url)) : undefined;
      return {
        trackRank: index + 1,
        overallRank,
        id: entry.id,
        attributes: entry.attributes,
        teamName: team?.teamName ?? null,
        tableNumber: team?.tableNumber ?? null,
        removed: entry.removed,
      };
    });

    // Every Devpost column, in the order the first project that has it lists it.
    const attributeNames = [
      ...new Set(rows.flatMap((row) => Object.keys(row.attributes))),
    ];
    const columns: CsvColumn<TrackRow>[] = [
      { header: "Track Rank", value: (row) => row.trackRank },
      { header: "Overall Rank", value: (row) => row.overallRank },
      { header: "id", value: (row) => row.id },
      ...attributeNames.map((name): CsvColumn<TrackRow> => ({
        header: name,
        value: (row) => row.attributes[name],
      })),
      { header: "Team", value: (row) => row.teamName },
      { header: "Table Number", value: (row) => row.tableNumber },
      { header: "Removed", value: (row) => row.removed },
    ];

    return csvResponse(
      serializeCsv(columns, rows),
      `judging-${slugify(track)}.csv`,
    );
  } catch (error) {
    console.error("[judging] track export failed:", track, error);
    return new Response("Could not export projects from the judging server.", {
      status: 502,
    });
  }
}

function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "track"
  );
}
