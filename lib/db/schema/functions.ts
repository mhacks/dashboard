import { sql } from "drizzle-orm";

// Referenced by Realtime RLS policies in realtime-policies.ts. Created in custom
// migration 20260715023217_is_organizer_realtime_and_triggers.sql.
export const isOrganizerFn = sql`public.is_organizer()`;
