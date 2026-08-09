import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "organizer") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const [log] = await db
    .select({ broadcastedToEmail: broadcastLogs.broadcastedToEmail })
    .from(broadcastLogs)
    .where(eq(broadcastLogs.id, id))
    .limit(1);

  if (!log) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse((log.broadcastedToEmail ?? []).join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
