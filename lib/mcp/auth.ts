import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

// Scopes this MCP server recognizes. A token must carry `application:write`
// (enforced via `requiredScopes` in withMcpAuth) to call the mutating tools.
export const MCP_SCOPES = ["application:write"];

interface SupabaseUser {
  id: string;
  email?: string;
  aud?: string;
  role?: string;
}

// Verifies a bearer token issued by Supabase Auth (GoTrue) and resolves it to
// the MCP `AuthInfo`. We hit GoTrue's `/auth/v1/user` endpoint, which validates
// the JWT signature + expiry server-side and returns the user identity. The
// resolved `userId` (never a value supplied by the agent) becomes the identity
// for every DB write.
export async function verifyToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !apiKey) return undefined;

  let user: SupabaseUser;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        apikey: apiKey,
      },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    user = (await res.json()) as SupabaseUser;
  } catch {
    return undefined;
  }

  if (!user?.id) return undefined;

  return {
    token: bearerToken,
    clientId: user.id,
    scopes: MCP_SCOPES,
    extra: {
      userId: user.id,
      email: user.email,
    },
  };
}
