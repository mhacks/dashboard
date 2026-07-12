import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Only ever called directly from OAuthConsentPage (a Server Component) — not
// a Server Action, so no "use server" here (see
// lib/actions/oauth-consent.server.actions.ts for the actual approve/deny
// actions the client component invokes).
//
// Wrapped in React's cache() because Next.js re-invokes Server Component
// render functions a second time in dev (its Strict-Mode-style check for
// impure renders), and Supabase's GET /oauth/authorizations/:id is NOT safe
// to call twice for an already-approved client: the first call auto-approves
// and finalizes it (returning a redirect), and a second call for the same
// authorization_id gets rejected with 400 "authorization request cannot be
// processed". cache() memoizes per authorizationId for the lifetime of a
// single request, so the duplicate render reuses the first call's result
// instead of hitting Supabase again. See agents/mcp-local-dev-runbook.md.
export const getAuthorizationDetails = cache(
  async (authorizationId: string) => {
    const supabase = await createClient();
    const { data, error } =
      await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to load authorization details");
    }
    return data;
  },
);
