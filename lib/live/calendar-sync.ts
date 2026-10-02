import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  buildSyncStatements,
  downloadCalendar,
  parseCalendar,
} from "@/scripts/lib/live-calendar.mjs";

export type CalendarSyncSummary = {
  scheduled: number;
  cancelled: number;
  /** Row counts by action: insert, update, unchanged, archive, missing (kept). */
  changes: Record<string, number>;
};

/**
 * The dashboard's "Sync calendar" button: the same import as
 * `pnpm live:sync --apply --publish`, sharing its parser and SQL so the two
 * can't drift. New events publish to /live; existing publishing, scanners,
 * RSVP settings and attendance are left alone; cancellations archive; events
 * missing from the feed are kept (no --archive-missing). One transaction, so
 * a refusal anywhere — bad feed, conflicting non-calendar event — writes
 * nothing.
 */
export async function syncLiveCalendar(): Promise<CalendarSyncSummary> {
  const events = parseCalendar(await downloadCalendar());
  const statements: string[] = buildSyncStatements(events, {
    publish: true,
    archiveMissing: false,
  });

  const rows = await db.transaction(async (tx) => {
    let last: unknown;
    for (const statement of statements) {
      last = await tx.execute(sql.raw(statement));
    }
    return last as { action: string; count: number }[];
  });

  const cancelled = events.filter(
    (e: { cancelled: boolean }) => e.cancelled,
  ).length;
  return {
    scheduled: events.length - cancelled,
    cancelled,
    changes: Object.fromEntries(rows.map((r) => [r.action, r.count])),
  };
}
