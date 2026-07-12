# MHacks MCP Server — Design Doc

Architecture and structure of the MCP server that lets AI agents apply to
MHacks on a user's behalf. For the underlying design rationale and
decision log, see [`agents/mcp-app.md`](../agents/mcp-app.md) and
[`agents/mcp-auth.md`](../agents/mcp-auth.md); for how to run/test it
locally, see [`agents/mcp-local-dev-runbook.md`](../agents/mcp-local-dev-runbook.md).
This doc is the "how it's built" reference.

---

## 1. Goal

Expose the MHacks application portal as an MCP server so agents (Claude,
Cursor, etc.) can — on behalf of a real, authenticated user — read the
application schema, save a draft, submit a hacker application, check
status, and upload a resume. Every mutation is tied to a real
authenticated identity and validated with the **exact same Zod rules**
the web form uses, so the MCP path can never write data the form would
reject.

---

## 2. High-level architecture

```
                    ┌─────────────────────────┐
   AI Agent  ──────▶│  MCP Server (this repo)  │──────▶ Postgres (Drizzle)
 (Claude, etc.)      │  app/api/mcp/[transport] │──────▶ S3 (resumes)
                     └───────────┬──────────────┘
                                 │ verifies bearer token
                                 ▼
                     ┌─────────────────────────┐
                     │  Supabase Auth (GoTrue)   │
                     │  = the OAuth 2.1 AS       │
                     │  (authorize/token/JWKS,   │
                     │   PKCE, refresh rotation, │
                     │   client registration)    │
                     └───────────┬──────────────┘
                                 │ redirects here for login+consent
                                 ▼
                     ┌─────────────────────────┐
                     │  Our Authorization UI     │
                     │  /oauth/consent (+ /login)│
                     └─────────────────────────┘
```

**Key architectural decision**: Supabase Auth's native OAuth 2.1 Server
(public beta, shipped late 2025) _is_ the Authorization Server. This repo
does not implement `/authorize`, `/token`, `/register`, PKCE validation,
or refresh rotation — all of that is Supabase's. What this repo owns:

1. A small **Authorization UI** (OTP login + consent screen) — the page
   Supabase redirects users to mid-flow.
2. **Token verification** (`verifyToken`) in the MCP route's auth
   middleware.
3. The **MCP tools themselves** — thin, auth-checked wrappers around
   application logic the web form already uses.

---

## 3. Components

### 3.1 MCP server — `app/api/mcp/[transport]/route.ts`

Built with `mcp-handler`'s `createMcpHandler`, wrapped in `withMcpAuth`
(`required: true`, `requiredScopes: ["application:write"]`). An
unauthenticated request gets a `401` with a `WWW-Authenticate` header
pointing at the protected-resource metadata — the standard signal that
kicks off OAuth discovery in any MCP client.

**Tools registered** (`server.registerTool`), all requiring a verified
token and deriving `userId` from it (never from a tool argument):

| Tool                          | Input                                   | Behavior                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apply_get_schema`            | —                                       | Returns `z.toJSONSchema(hackerApplicationSchema)` — the real source-of-truth schema, not a hand-maintained copy.                                                                                                                                                                                                                           |
| `apply_get_draft`             | —                                       | Returns the user's in-progress draft (if any), plus `resumeUploaded`, so an agent doesn't re-ask for fields already saved.                                                                                                                                                                                                                 |
| `apply_save_draft`            | `baseApplicationSchema.partial().shape` | Upserts into `hacker_application_drafts`, merging into the existing draft. Rate-limited: 20/min per user.                                                                                                                                                                                                                                  |
| `apply_submit`                | `baseApplicationSchema.shape`           | Validates + inserts into `hacker_applicants`. Requires all MLH agreement booleans explicitly true (the tool description instructs the agent to get explicit user confirmation first — never assume consent). Irreversible: no update/withdraw tool exists. Returns `{ duplicate: true }` if already applied. Rate-limited: 5/min per user. |
| `apply_status`                | —                                       | Returns `{ hasApplication, status, application }` for the authenticated user.                                                                                                                                                                                                                                                              |
| `apply_get_resume_upload_url` | `{ fileName }`                          | Presigned S3 PUT URL (short-lived) + the storage `key` to pass to `apply_submit`. The agent must be able to execute its own HTTP request to actually upload — the tool description explicitly says to fall back to "tell the user to upload at mhacks.org/apply" if the agent can't (many chat-only clients can't; see §6).                |

**Prompt registered** (`server.registerPrompt`): `apply_interview` — a
reusable "Apply to MHacks" prompt template that walks an agent through
the full interview flow step by step (check draft → get schema →
interview only for missing fields → checkpoint with save_draft →
resume → read MLH terms and get explicit consent → summarize → submit).
This is where the _process_ is encoded, separately from the tools
themselves being unopinionated.

**Security properties baked into every tool:**

- Identity always comes from `requireUserId(extra.authInfo)` — the
  verified token's `sub` claim — never a tool argument. An agent cannot
  apply on behalf of anyone but the authenticated user.
- Per-user rate limiting on the two mutating tools.
- `apply_submit` enforces the same Zod schema (`lib/types/applications.ts`)
  the web form's server actions use — same source, so the MCP path can't
  write anything the form would reject.

### 3.2 Token verification — `lib/mcp/auth.ts`

`verifyToken(req, bearerToken)` calls `supabase.auth.getClaims(bearerToken)`
on a module-level bare `@supabase/supabase-js` client (no session
persistence — this is a stateless verifier, not a logged-in client).

- Under an **asymmetric signing key** (RS256/ES256), `getClaims` verifies
  locally against the project's JWKS (cached on the client instance).
- Under the **HS256 default** (current state), it transparently falls
  back to a server-side check — so this code works identically before
  and after any future signing-key migration.
- Claim mapping: `sub` (the user) → `extra.userId`; `client_id` (the
  requesting OAuth app) → `clientId`, falling back to `sub` for plain
  session JWTs (which carry no `client_id`).
- `scopes` is the statically-granted `MCP_SCOPES = ["application:write"]`,
  **not** read from the token's own `scope` claim — Supabase issues
  standard OAuth scopes (`openid`/`email`/...) that will never contain
  this app-specific marker. The real authorization gate is OTP login +
  explicit consent, not scope negotiation.
- Returns `undefined` on any failure (missing token, verification error,
  no `sub`) — `withMcpAuth` turns that into a `401`.

**Important, non-obvious property**: access tokens are self-contained
JWTs, verified statelessly. Revoking a grant at `/account/connections`
invalidates the _refresh token_ — it does not retroactively invalidate
an already-issued access token, which stays valid until its own `exp`
(Supabase default: 1 hour, no override set in `supabase/config.toml`).
See §7.

### 3.3 OAuth Protected Resource Metadata — `app/.well-known/oauth-protected-resource/route.ts`

RFC 9728 endpoint via `mcp-handler`'s `protectedResourceHandler`,
pointing `authServerUrls` at Supabase (`${SUPABASE_URL}/auth/v1`). This
is how a client discovers _which_ server handles authorization for this
resource, after getting the `401`. Exports CORS-enabled `OPTIONS` too,
since browser-based MCP clients call this cross-origin.

### 3.4 Authorization UI

- **`app/oauth/consent/page.tsx`** (Server Component) — the page
  Supabase's OAuth server redirects to (configured via
  `[auth.oauth_server].authorization_url_path` in `supabase/config.toml`).
  Reads `authorization_id` from search params, checks
  `supabase.auth.getUser()`; if signed out, redirects to
  `/login?next=/oauth/consent?authorization_id=...` (reusing the
  existing OTP login page unmodified). Calls
  `getAuthorizationDetails(authorization_id)` — if Supabase indicates
  this client is already approved, it returns an `OAuthRedirect` and the
  page redirects immediately, skipping the consent screen entirely on
  repeat connects.
- **`app/oauth/consent/consent-screen.tsx`** (Client Component) — shows
  the requesting client's name, the signed-in user's email, and
  requested scopes; Approve/Deny call server actions via `useTransition`.
- **`lib/actions/oauth-consent.server.actions.ts`** — thin wrappers
  around `supabase.auth.oauth.{getAuthorizationDetails,
approveAuthorization, denyAuthorization}`, using the existing
  cookie-based `createClient()`. Server Actions have no `window`, so
  unlike the SDK's browser-only auto-redirect, these explicitly call
  `redirect(data.redirect_url)` themselves.
- **No new login page** — `app/login/page.tsx`'s existing OTP form
  already supports a `next` redirect param, reused as-is.

### 3.5 Connected-apps / revocation — `app/account/connections/`

- **`page.tsx`** + **`connections-list.tsx`** — lists the user's OAuth
  grants (client name, scopes, granted date) via
  `supabase.auth.oauth.listGrants()`.
- **`lib/actions/oauth-grants.server.actions.ts`** — `revokeGrant({ clientId })`.
  See §7 for what revocation actually does and doesn't do.
- Not linked from any nav yet — reachable by direct URL only.

### 3.6 Shared application logic — `lib/actions/application-form.actions.ts`

The refactor that makes the whole design work: pure, `userId`-parameterized
functions extracted from the cookie-bound web-form server actions, so the
web form and the MCP server share **one code path** — same Zod rules,
same Drizzle writes:

- `submitHackerApplicationForUser(userId, data)`
- `saveDraftForUser(userId, data)`
- `getApplicationStatusForUser(userId)`
- `getDraftForUser(userId)`

`lib/actions/application-form.server.actions.ts` (the original,
cookie-based server actions the web form calls) now resolve `userId` from
cookies and delegate to these same functions — web form behavior is
unchanged, but there's no logic duplication between the two entry points.

### 3.7 Data model

Two tables touched (`lib/db/schema/applications.ts`), both scoped by
`user_id`:

- `hacker_applicants` — submitted applications (`application_status` enum:
  pending/etc.).
- `hacker_application_drafts` — in-progress drafts, `data jsonb`, merged
  on save.

Resumes live in S3 (prod) / Supabase Storage's S3-compatible API
(local), never in Postgres — only the storage `key` is stored on the
application row.

---

## 4. Request lifecycle (a full apply flow)

```
1. Agent → GET/POST /api/mcp/mcp, no token
   ← 401 + WWW-Authenticate: resource_metadata=".../oauth-protected-resource"

2. Agent → GET /.well-known/oauth-protected-resource
   ← { authorization_servers: ["<SUPABASE_URL>/auth/v1"] }

3. Agent → GET <SUPABASE_URL>/auth/v1/.well-known/oauth-authorization-server
   ← { authorization_endpoint, token_endpoint, jwks_uri, ... }

4. Agent → GET <authorization_endpoint>?response_type=code&client_id=...
           &code_challenge=...&redirect_uri=...  (PKCE)
   Supabase redirects → our /oauth/consent?authorization_id=...

5. Our app: not logged in → /login?next=... → OTP → verifyOtp
   → back to /oauth/consent → renders client/user/scope → user clicks Approve
   → approveAuthorization() → redirect back to Supabase → redirect to
     the agent's redirect_uri with an authorization code

6. Agent → POST <token_endpoint> (code + code_verifier)
   ← { access_token, refresh_token }   (Supabase-issued JWT)

7. Agent → tools/list, tool calls with `Authorization: Bearer <access_token>`
   → withMcpAuth → verifyToken → getClaims → AuthInfo{ userId, clientId, scopes }
   → tool handler runs, using userId from the verified token only
```

Steps 1–3 happen once per client per machine (cacheable discovery); 4–6
happen once per user-client pair until the grant is revoked or the
refresh token is invalidated; step 7 happens on every tool call, with
silent refresh (step 6's `grant_type=refresh_token` variant) handling
access-token expiry transparently to the agent.

---

## 5. Client registration model

Dynamic Client Registration is **off**
(`allow_dynamic_registration = false` in `supabase/config.toml`) —
Supabase doesn't support CIMD (DCR's likely successor) yet, and DCR has a
reported redirect_uri-matching bug for loopback clients. Clients are
registered manually via `supabase.auth.admin.oauth.createClient()` (see
`scripts/register-mcp-client.ts` for local testing) or the dashboard's
OAuth Apps page for production. Exact `redirect_uri` string match
required — no wildcards.

This is a deliberate manual-allowlist tradeoff: no open registration
surface, at the cost of needing to register each new target client
(Claude.ai, Cursor, etc.) by hand. See `agents/mcp-auth.md` §4 for the
fuller reasoning and the CIMD-migration caveat.

---

## 6. Known limitations / deferred

- **Resume upload requires the agent to make its own HTTP request** —
  works for coding-agent-style clients with terminal/network tool access
  (Claude Code, Cursor), not for standard chat-only clients (Claude.ai,
  Claude Desktop web chat) even with a file attached to the
  conversation, since "the agent read the file" and "the agent can PUT
  raw bytes to an arbitrary URL" are different capabilities. Deferred
  fallback ideas (base64 small-file path, accept-an-existing-URL with an
  SSRF guard) — not built; the current fallback is "upload at
  mhacks.org/apply, then re-check via `apply_get_draft`."
- **Revocation is not instant** — see §3.2. Only affects refresh, not a
  currently-valid access token, by JWT design.
- **Signing key is still HS256** — the one genuinely dashboard-only
  manual step (asymmetric RS256/ES256 is a project-wide "JWT Signing
  Keys" setting, not exposed in `config.toml`). Not required for current
  correctness (`getClaims` falls back correctly under HS256), only for
  `openid` scope support and local-JWKS-verification latency.
- **Judge applications not exposed over MCP** — hacker-only for now;
  `judgeApplicants` shares columns with `hackerApplicants`, so an
  `applicantType` arg could be added later if needed.
- **No rate limit on reads** (`apply_status`, `apply_get_schema`,
  `apply_get_draft`) — only the two mutating tools are limited.
