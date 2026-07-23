"use server";

import { redirect } from "next/navigation";
import { getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

// Consent-page actions for Supabase's native OAuth 2.1 Server (see
// agents/mcp-auth.md). Both calls run against the signed-in user's own
// session — Supabase resolves `authorization_id` -> client/scope internally
// and rejects the call if there's no session, so there's nothing here for us
// to validate ourselves.
//
// getAuthorizationDetails lives in ./oauth-consent.actions.ts instead (not a
// Server Action — only called directly from the Server Component page).

export async function approveAuthorization(authorizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } =
    await supabase.auth.oauth.approveAuthorization(authorizationId);
  if (error || !data?.redirect_url) {
    throw new Error(error?.message ?? "Failed to approve authorization");
  }
  if (user) {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "mcp_connected",
    });
    await posthog.flush();
  }
  redirect(data.redirect_url);
}

export async function denyAuthorization(authorizationId: string) {
  const supabase = await createClient();
  const { data, error } =
    await supabase.auth.oauth.denyAuthorization(authorizationId);
  if (error || !data?.redirect_url) {
    throw new Error(error?.message ?? "Failed to deny authorization");
  }
  redirect(data.redirect_url);
}
