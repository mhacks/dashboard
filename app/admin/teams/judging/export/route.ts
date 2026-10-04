import { requireOrganizer } from "@/lib/auth/guards";
import { getExportCsv } from "@/lib/judging/mdredd";
import { syncTablesToMdredd } from "@/lib/judging/teams";
import { filterExportByTrack } from "@/lib/judging/tracks";

export const dynamic = "force-dynamic";

/**
 * MDredd's project export with the Table Number column. Tables are synced
 * first, when the rate limit allows, so the column reflects current assignments.
 *
 * With `?track=`, only the projects that entered that track.
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
  try {
    await syncTablesToMdredd();
  } catch (error) {
    // Usually MDredd's admin rate limit. The export still has the last synced tables.
    console.error("[judging] table sync before export failed:", error);
  }
  try {
    const csv = await getExportCsv();
    return new Response(track ? filterExportByTrack(csv, track) : csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(track)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[judging] export failed:", error);
    return new Response("Could not export projects from the judging server.", {
      status: 502,
    });
  }
}

function exportFilename(track: string | undefined) {
  const slug = track
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `judging-projects-${slug}.csv` : "judging-projects.csv";
}
