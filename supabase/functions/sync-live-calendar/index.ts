import { timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import {
  buildSyncStatements,
  downloadCalendar,
  parseCalendar,
} from "../_shared/live-calendar.mjs";

/**
 * The dashboard's "Sync calendar" button, on a timer: pg_cron calls this
 * every minute (see the calendar_sync_cron migration). Same parser, SQL and
 * options as syncLiveCalendar, so a scheduled sync and a click can't differ.
 * /live is force-dynamic, so there's no cache to revalidate.
 *
 * verify_jwt is off for this function; callers prove themselves with the
 * x-cron-secret header instead, which pg_cron reads from Vault.
 */
const secret = Deno.env.get("CALENDAR_SYNC_SECRET") ?? "";
const db = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
});

function authorized(req: Request) {
  const given = new TextEncoder().encode(
    req.headers.get("x-cron-secret") ?? "",
  );
  const expected = new TextEncoder().encode(secret);
  return (
    expected.length > 0 &&
    given.length === expected.length &&
    timingSafeEqual(given, expected)
  );
}

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  try {
    const events = parseCalendar(await downloadCalendar());
    const statements: string[] = buildSyncStatements(events, {
      publish: true,
      archiveMissing: true,
      restoreArchived: true,
      guardMassArchive: true,
    });
    const rows = await db.begin(async (tx) => {
      let last: unknown;
      for (const statement of statements) last = await tx.unsafe(statement);
      return last as { action: string; count: number }[];
    });
    const changes = Object.fromEntries(rows.map((r) => [r.action, r.count]));
    return Response.json({ changes });
  } catch (error) {
    // A refusal (bad feed, conflicting event, mass archive) wrote nothing.
    // Report the message only: database errors can carry the whole statement.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Calendar sync failed: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
});
