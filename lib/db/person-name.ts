import { sql } from "drizzle-orm";

import { hackerApplicants } from "@/lib/db/schema/applications";
import { users } from "@/lib/db/schema/users";

/**
 * What to call a person on screen: the full name off their application, or
 * their account email when there isn't one.
 *
 * public.users has no name column, so a name can only come from the
 * application — and that row may be missing, either because it was deleted or
 * because the person never applied, which is the normal case for an organizer.
 * The email fallback is what keeps those rows displayable at all: a roster line
 * that silently drops a check-in that happened is worse than one showing an
 * email, and at a door an amber duplicate without a name can't tell a volunteer
 * "you already came in" from "who are you".
 *
 * A plain fragment rather than a function over table references, because it
 * reads `users` and `hackerApplicants` by name: any query using it must join
 * both unaliased. A second `users` join in the same statement needs its own
 * subquery regardless — see the staff CTE in `lib/queries/events.ts`.
 */
export const personNameSql = sql<string>`coalesce(
  nullif(trim(${hackerApplicants.firstName} || ' ' || ${hackerApplicants.lastName}), ''),
  ${users.email}
)`;
