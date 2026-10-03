import { requireOrganizer } from "@/lib/auth/guards";
import { getExportCsv } from "@/lib/judging/mdredd";
import { syncTablesToMdredd } from "@/lib/judging/teams";

export const dynamic = "force-dynamic";

/**
 * MDredd's project export with the Table Number column. Tables are synced
 * first, when the rate limit allows, so the column reflects current assignments.
 */
export async function GET() {
  try {
    await requireOrganizer();
  } catch {
    return new Response("Only organizers can export projects.", {
      status: 403,
    });
  }
  try {
    await syncTablesToMdredd();
  } catch (error) {
    // Usually MDredd's admin rate limit. The export still has the last synced tables.
    console.error("[judging] table sync before export failed:", error);
  }
  try {
    const csv = await getExportCsv();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="judging-projects.csv"',
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
