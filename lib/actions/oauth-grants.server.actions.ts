"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Connected-apps actions for Supabase's native OAuth 2.1 Server (see
// agents/mcp-auth.md §8). Both run against the signed-in user's own session —
// grants are scoped to that user by Supabase, so no extra authorization
// checks are needed here.

export async function listGrants() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.listGrants();
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

// Revocation marks consent as revoked, deletes the client's active sessions,
// and invalidates its refresh tokens (per the SDK's documented behavior).
export async function revokeGrant(clientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/account/connections");
}
