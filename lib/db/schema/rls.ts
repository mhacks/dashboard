import { sql } from "drizzle-orm";
import { authUid } from "drizzle-orm/supabase";

export const isOrganizer = sql`exists (
  select 1
  from public.users
  where id = ${authUid}
    and role = 'organizer'
)`;
