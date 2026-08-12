import { getAdminRsvpExportRows } from "@/lib/queries/admin-rsvps";
import { serializeAdminRsvpExport } from "@/lib/rsvp/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const rows = await getAdminRsvpExportRows();
    const csv = serializeAdminRsvpExport(rows);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="mhacks-2026-rsvps-${date}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
