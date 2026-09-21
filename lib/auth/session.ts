import { cache } from "react";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users, type UserEntry } from "@/lib/db/schema/users";

type SessionClaims = {
  sub?: string;
  email?: unknown;
};

function emailFromClaims(email: unknown): string | null {
  return typeof email === "string" && email.length > 0 ? email : null;
}

// public.users is the source of role; Auth only tells us who the JWT is for.
// getClaims verifies locally against JWKS (ES256 in production) instead of
// calling Auth's /user endpoint the way getUser() does on every request.
export async function getSessionUserFromClaims(
  claims: SessionClaims | null | undefined,
): Promise<UserEntry | null> {
  const userId = claims?.sub;
  if (!userId) return null;

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (row) return row;

  const email = emailFromClaims(claims.email);
  if (!email) return null;

  const [created] = await db
    .insert(users)
    .values({
      id: userId,
      email,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
      },
    })
    .returning();

  return created ?? null;
}

// Returns the public.users row for the authenticated user, or null if
// unauthenticated or the row cannot be found.
//
// Deduplicated per request: a page that runs two guarded queries (the scanner
// reads its event, then its count) would otherwise pay a JWT verify and a
// users read for each one.
export const getSessionUser = cache(async (): Promise<UserEntry | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return getSessionUserFromClaims(data?.claims);
});
