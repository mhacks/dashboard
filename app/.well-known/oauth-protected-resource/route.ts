import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from "mcp-handler";

// RFC 9728 Protected Resource Metadata. MCP clients fetch this after receiving a
// 401 from /mcp; it points them at the OAuth 2.1 Authorization Server
// (Supabase GoTrue) so they can run the Authorization Code + PKCE flow.
const authServerUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/auth/v1`;

const handler = protectedResourceHandler({
  authServerUrls: [authServerUrl],
});

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
