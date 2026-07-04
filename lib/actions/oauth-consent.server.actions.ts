"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Consent-page actions for Supabase's native OAuth 2.1 Server (see
// agents/mcp-auth.md). All three calls run against the signed-in user's own
// session — Supabase resolves `authorization_id` -> client/scope internally
// and rejects the call if there's no session, so there's nothing here for us
// to validate ourselves.

export async function getAuthorizationDetails(authorizationId: string) {
  const supabase = await createClient();
  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to load authorization details");
  }
  return data;
}

export async function approveAuthorization(authorizationId: string) {
  const supabase = await createClient();
  const { data, error } =
    await supabase.auth.oauth.approveAuthorization(authorizationId);
  if (error || !data?.redirect_url) {
    throw new Error(error?.message ?? "Failed to approve authorization");
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
