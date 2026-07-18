import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Scopes this MCP server recognizes. A token must carry `application:write`
// (enforced via `requiredScopes` in withMcpAuth) to call the mutating tools.
// These are granted after identity verification, not read from the token's
// OAuth `scope` claim — Supabase's OAuth server issues standard scopes
// (openid/email/...), and the real gate is OTP login + consent
// (agents/mcp-auth.md §4).
export const MCP_SCOPES = ["application:write"];

// Module-level singleton so getClaims' JWKS cache survives across requests.
let verifier: SupabaseClient | null = null;
function getVerifier(): SupabaseClient | null {
  if (verifier) return verifier;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !apiKey) return null;
  verifier = createClient(supabaseUrl, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return verifier;
}

// Verifies a bearer token issued by Supabase Auth (GoTrue) and resolves it to
// the MCP `AuthInfo`. `getClaims` verifies locally against the project's JWKS
// when an asymmetric signing key (RS256/ES256) is configured, and falls back
// to a server-side check (equivalent to `getUser`) under the HS256 default —
// so this works both before and after the signing-key migration. The resolved
// `userId` (never a value supplied by the agent) becomes the identity for
// every DB write.
export async function verifyToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const supabase = getVerifier();
  if (!supabase) return undefined;

  try {
    const { data, error } = await supabase.auth.getClaims(bearerToken);
    if (error || !data?.claims?.sub) return undefined;

    const { claims } = data;
    return {
      token: bearerToken,
      // OAuth-server-issued tokens carry the requesting app's `client_id`;
      // plain session JWTs (PAT-style usage) don't, so fall back to the user.
      clientId:
        typeof claims.client_id === "string" ? claims.client_id : claims.sub,
      scopes: MCP_SCOPES,
      extra: {
        userId: claims.sub,
        email: claims.email,
        sessionId:
          typeof claims.session_id === "string" ? claims.session_id : undefined,
      },
    };
  } catch {
    return undefined;
  }
}

// `getClaims` (above) is a self-contained JWT check — locally against JWKS
// under an asymmetric signing key, so it never touches the database and
// can't see that a session was revoked (see agents/mcp-auth.md §8). Revoking
// an OAuth grant deletes the corresponding row from Supabase's own
// `auth.sessions` table, so checking that row directly is the only way to
// get a live answer. Used as an extra guard on tools that read/write
// application data or identity, not on every call — it costs a DB
// round-trip, so it's reserved for where a stale-but-unexpired token
// actually matters.
export async function isSessionActive(sessionId: string): Promise<boolean> {
  const rows = await db.execute(
    sql`select 1 from auth.sessions where id = ${sessionId} limit 1`,
  );
  return rows.length > 0;
}
