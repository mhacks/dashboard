import { sql } from "drizzle-orm";

// Referenced by Realtime RLS policies in realtime-policies.ts. Created in custom
// migration 20260715001005_is_organizer_function.sql.
export const isOrganizerFn = sql`public.is_organizer()`;
