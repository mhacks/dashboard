"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth/guards";
import {
  syncLiveCalendar,
  type CalendarSyncSummary,
} from "@/lib/live/calendar-sync";

/* Returns the error rather than throwing it: production builds replace a
   thrown server-action message with a generic digest, and the reason a sync
   was refused (a conflicting event, a bad feed) is what the organizer needs
   to see. */
export async function syncLiveCalendarAction(): Promise<
  { summary: CalendarSyncSummary; error: null } | { error: string }
> {
  await requireOrganizer();
  try {
    const summary = await syncLiveCalendar();
    revalidatePath("/live");
    return { summary, error: null };
  } catch (error) {
    console.error("Calendar sync failed", error);
    // Drizzle wraps database errors as "Failed query: <the whole statement>",
    // calendar JSON included; the Postgres message underneath is the useful
    // part (e.g. the duplicate-event guard's explanation).
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause
        : error;
    return {
      error:
        cause instanceof Error
          ? cause.message
          : "Calendar sync failed. Try again in a moment.",
    };
  }
}
