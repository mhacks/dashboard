import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  buildSyncStatements,
  downloadCalendar,
  parseCalendar,
} from "@/supabase/functions/_shared/live-calendar.mjs";

export type CalendarSyncSummary = {
  scheduled: number;
  cancelled: number;
  /** Row counts by action: insert, update, unchanged, archive, missing (kept). */
  changes: Record<string, number>;
};

/**
 * The dashboard's "Sync calendar" button. /live follows the calendar: new
 * events publish, edits overwrite, events deleted or cancelled in the
 * calendar are archived (hidden, never deleted — check-ins and attendance
 * stay), and archived events that come back to the calendar are republished.
 * Scanners, RSVP settings and events not created by the calendar are left
 * alone.
 *
 * Shares its parser and SQL with `pnpm live:sync` so the two can't drift.
 * One transaction: a refusal anywhere — bad feed, conflicting non-calendar
 * event, or a sync that would archive most of the schedule at once (a
 * truncated feed, most likely) — writes nothing.
 */
export async function syncLiveCalendar(
  /** The .ics text; downloaded from the public feed when omitted. */
  source?: string,
): Promise<CalendarSyncSummary> {
  const events = parseCalendar(source ?? (await downloadCalendar()));
  const statements: string[] = buildSyncStatements(events, {
    publish: true,
    archiveMissing: true,
    restoreArchived: true,
    guardMassArchive: true,
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
