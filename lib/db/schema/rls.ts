import { sql } from "drizzle-orm";
import { authUid } from "drizzle-orm/supabase";

export const isOrganizer = sql`exists (
  select 1
  from public.users
  where id = ${authUid}
    and role = 'organizer'
)`;

/**
 * Who may run a check-in scanner. Wider than `isOrganizer` on purpose —
 * volunteers work the door and the meal lines, and promoting every one of them
 * to organizer to let them scan would hand out the whole admin portal with it.
 *
 * Scanning is the only thing this grants. Creating events, reading a roster and
 * reverting a mis-scan all stay on `isOrganizer`.
 *
 * `admin` is deliberately excluded, matching `isOrganizer` above: the role
 * exists in the enum but nothing in this app grants it anything, and quietly
 * making it meaningful here would be a surprise.
 */
export const isEventStaff = sql`exists (
  select 1
  from public.users
  where id = ${authUid}
    and role in ('organizer', 'volunteer')
)`;
