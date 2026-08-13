# `/how-to-mcp` page — design

## Goal

A public, static docs page at `/how-to-mcp` explaining how to connect an AI
agent (Claude, Codex, or any custom MCP client) to the MHacks MCP server.
Content is adapted from `mcp-docs/INSTRUCTIONS.md`, which already covers
Claude.ai/Desktop and Claude Code but not Codex or a developer-facing auth
explanation. Not linked from nav yet (no UI decision made for that) —
reachable by direct URL only, same as `/account/connections` currently is.

## Route & rendering

- `app/how-to-mcp/page.tsx` — Server Component, no auth check (public).
- Full page using `NavBar` + `SiteFooter` (same components as `app/page.tsx`),
  with the doc body in between.
- Static content only — no data fetching, no client components needed
  (a "copy URL" button would need `"use client"`; skip it, plain `<code>`
  block is enough for v1).

## Visual style

Match the existing brand system already used on `/account/connections` and
the homepage:

- Background: cream (`#faf9f4` card / `#efe9d4` page band).
- Headings: `font-heading` (Instrument Serif), italic, `#3A4A26`.
- Body text: `font-red-hat`, `rgba(58,74,38,0.6)` for secondary text.
- Borders: `#c8d4a8`.
- Code/URL callouts: monospace block with the same border color.
- Reuse `Card`/`CardHeader`/`CardContent` from `components/ui/card` for
  each major section, consistent with `connections-list.tsx`.

## Content structure

1. **Header** — "Connect an AI agent to MHacks" + one-line explainer that
   this lets an agent apply to MHacks on the user's behalf.
2. **Server URL callout** — `https://mhacks.org/api/mcp/mcp` in a code block.
3. **Connect your client** — one subsection per client:
   - **Claude.ai / Claude Desktop** — Settings → Connectors → Add custom
     connector → paste URL → login (OTP) → approve. (from INSTRUCTIONS.md)
   - **Claude Code** — `claude mcp add --transport http mhacks
https://mhacks.org/api/mcp/mcp`, then `/mcp` → select → authenticate.
     (from INSTRUCTIONS.md)
   - **Codex CLI** (new) — best-effort instructions based on current
     knowledge of Codex's MCP config (`~/.codex/config.toml`,
     `[mcp_servers.mhacks]` block with a `url` field, OAuth login triggered
     on first use). Mark with an inline code comment flagging this for
     verification against current Codex docs before the team treats it as
     authoritative — Codex's remote-MCP/OAuth support may have changed
     since the assistant's knowledge cutoff.
   - **Other MCP clients** — generic guidance: any client supporting MCP
     Streamable HTTP + OAuth 2.1 can connect with the same URL; same
     email-login-and-approve flow regardless of client. (from
     INSTRUCTIONS.md)
4. **What you can do** — example prompts: check application status, fill
   out application (draft-and-resume), submit. (from INSTRUCTIONS.md)
5. **How auth works (for users)** — plain-language: identity comes from
   login not from what you tell the agent; submission is final; resume
   upload usually requires a coding-agent-style client (Claude Code,
   Cursor) not chat-only clients; revoke anytime at
   `/account/connections`. (from INSTRUCTIONS.md, lightly reworded)
6. **Building a custom integration (for developers)** — new section,
   summarizing `mcp-docs/DESIGN_DOC.md` §4–5 at a level appropriate for an
   external developer:
   - Transport: MCP Streamable HTTP at the server URL above.
   - Auth: OAuth 2.1, with Supabase Auth as the Authorization Server (not
     this app) — discovery via 401 + `WWW-Authenticate` →
     `/.well-known/oauth-protected-resource` → Supabase's own
     `/.well-known/oauth-authorization-server`.
   - PKCE required.
   - Dynamic Client Registration is off — a `client_id` + exact
     `redirect_uri` must be registered manually; contact the MHacks team
     to get one for a custom agent.
   - Access tokens are scoped to `application:write`; identity is always
     the authenticated user, never a value the agent supplies.
7. **Trouble connecting?** — brief troubleshooting note (exact URL,
   "Client ID" prompts mean no dynamic registration — contact MHacks team).
   (from INSTRUCTIONS.md)

## Out of scope

- Adding a nav link to this page (explicitly deferred — no UI decision
  made yet for where it goes).
- A "copy to clipboard" button or any other client-side interactivity.
- Changing `mcp-docs/INSTRUCTIONS.md` itself (it stays as the
  markdown/repo-internal reference; this page is the public-facing
  rendering, adapted and expanded, not a redirect or generated copy).
