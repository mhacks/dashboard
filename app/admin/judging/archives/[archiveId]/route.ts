import { requireOrganizer } from "@/lib/auth/guards";
import { downloadArchive, MdreddError } from "@/lib/judging/mdredd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARCHIVE_ID = /^\d{8}T\d{12}Z(?:-\d+)?$/u;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ archiveId: string }> },
): Promise<Response> {
  try {
    await requireOrganizer();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const { archiveId } = await params;
  if (!ARCHIVE_ID.test(archiveId)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const upstream = await downloadArchive(archiveId);
    return new Response(upstream.body, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${archiveId}.zip"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof MdreddError && error.status === 404) {
      return new Response("Not found", { status: 404 });
    }
    return new Response("The archive could not be downloaded.", {
      status: 502,
    });
  }
}
