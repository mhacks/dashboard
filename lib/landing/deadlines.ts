/*
  The application timeline moved to lib/config/schedule.ts, alongside the RSVP
  deadlines it used to be able to contradict.

  This file stays as a re-export because the landing components import from
  here and are deliberately left alone (they are re-art-directed each year).
  Its old handoff note said this was the single source of truth for the hero
  countdown; that is now literally true, one level down.
*/

import { DEADLINES } from "@/lib/config/schedule";
import { formatEventDate } from "@/lib/format/date";

export {
  DEADLINES,
  getNextDeadline,
  getTimeParts,
  type Deadline,
  type TimeParts,
} from "@/lib/config/schedule";

/** Format a deadline id as a human-readable calendar date. */
export function formatDeadlineDate(id: string): string {
  const deadline = DEADLINES.find((d) => d.id === id);
  if (!deadline) return "";
  return formatEventDate(deadline.date);
}
