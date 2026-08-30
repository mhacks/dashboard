import { sql } from "drizzle-orm";

/**
 * Both helpers call a SECURITY DEFINER function rather than inlining the EXISTS
 * they used to, and that is not a style preference.
 *
 * `users_select_own_or_organizer` is itself a policy on public.users. An EXISTS
 * over public.users written inside a policy therefore sends Postgres back
 * through that policy, and it gives up with "infinite recursion detected in
 * policy for relation users". Because every policy in this schema is built on
 * these two helpers, that error was not confined to the users table — reading
 * an applicant, an rsvp or a check-in as `authenticated` hit it too. Nothing
 * noticed only because the app connects as the owner role, which skips RLS
 * entirely.
 *
 * A definer-rights function reads the table as its owner, so no policy applies
 * to the read and there is nothing to recurse into. Wrapped in a SELECT so the
 * planner evaluates it once per statement instead of once per row — the same
 * reason drizzle renders auth.uid() that way.
 *
 * Both live in 20260830201411_rls_definer_helpers.sql. is_organizer() is older
 * than that: 20260715023217 added it for the realtime policies, which have been
 * calling it — and working — all along.
 */
export const isOrganizer = sql`(select public.is_organizer())`;

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
export const isEventStaff = sql`(select public.is_event_staff())`;
