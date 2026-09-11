import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOrganizer();
  } catch {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { id } = await params;

  const [log] = await db
    .select({ deliveredTo: broadcastLogs.deliveredTo })
    .from(broadcastLogs)
    .where(eq(broadcastLogs.id, id))
    .limit(1);

  if (!log) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return new NextResponse((log.deliveredTo ?? []).join("\n"), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="broadcast-${id}-recipients.txt"`,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
