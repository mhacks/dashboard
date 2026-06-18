import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users, type UserEntry } from "@/lib/db/schema/users";

// Returns the public.users row for the authenticated user, or null if
// unauthenticated or the row cannot be found.
export async function getSessionUser(): Promise<UserEntry | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return row ?? null;
}
