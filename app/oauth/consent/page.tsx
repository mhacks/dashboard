import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizationDetails } from "@/lib/actions/oauth-consent.server.actions";
import { ConsentScreen } from "./consent-screen";

// Supabase's OAuth 2.1 Server (Authentication > OAuth Server in the
// dashboard) redirects here as `/oauth/consent?authorization_id=...` mid
// authorization-code flow. See agents/mcp-auth.md §5/§6.
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id } = await searchParams;
  if (!authorization_id) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/oauth/consent?authorization_id=${authorization_id}`,
      )}`,
    );
  }

  const details = await getAuthorizationDetails(authorization_id);

  // Supabase omits `authorization_id` from the response (returning only
  // `redirect_url`) when the user already approved this client before —
  // skip the consent screen and send them straight back.
  if (!("authorization_id" in details)) {
    redirect(details.redirect_url);
  }

  return (
    <ConsentScreen authorizationId={authorization_id} details={details} />
  );
}
