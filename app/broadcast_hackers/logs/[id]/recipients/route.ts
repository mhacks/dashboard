import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastLogs } from "@/lib/db/schema/broadcasts";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "organizer") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const type = request.nextUrl.searchParams.get("type");

  const [log] = await db
    .select()
    .from(broadcastLogs)
    .where(eq(broadcastLogs.id, id))
    .limit(1);

  if (!log) {
    return new NextResponse("Not found", { status: 404 });
  }

  const isEmail = type === "email";
  const items: string[] = isEmail
    ? (log.broadcastedToEmail as string[]) ?? []
    : (log.broadcastedToText as string[]) ?? [];

  return new NextResponse(items.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
