import { cache } from "react";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users, type UserEntry } from "@/lib/db/schema/users";

// Returns the public.users row for the authenticated user, or null if
// unauthenticated or the row cannot be found.
//
// Deduplicated per request: a page that runs two guarded queries (the scanner
// reads its event, then its count) would otherwise pay a Supabase Auth round
// trip and a users read for each one.
export const getSessionUser = cache(async (): Promise<UserEntry | null> => {
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

  if (row) return row;
  if (!user.email) return null;

  const [created] = await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
      },
    })
    .returning();

  return created ?? null;
});
