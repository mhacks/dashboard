# How-to-MCP Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public docs page at `/how-to-mcp` explaining how to connect Claude, Codex, or a custom MCP client to the MHacks MCP server.

**Architecture:** A single static Next.js Server Component page (`app/how-to-mcp/page.tsx`) reusing the existing `NavBar`/`SiteFooter` components and the site's brand styling (cream/green palette, `Card` from `components/ui/card`). No data fetching, no client-side interactivity, no new dependencies.

**Tech Stack:** Next.js App Router, React Server Components, Tailwind (inline `style` for brand hex colors, matching existing convention in `app/account/connections/connections-list.tsx`).

## Global Constraints

- No test framework exists in this repo (`package.json` scripts are `lint`, `build`, `format` only — no `test` script). Verification is: `pnpm lint`, `pnpm build` (typecheck via `next build`), and a manual check with `pnpm dev`.
- Page must be public — no auth check, no redirect.
- Do not add a nav link to this page (explicitly deferred per spec).
- Do not modify `mcp-docs/INSTRUCTIONS.md` — it stays as the repo-internal reference; this page is a separate, adapted, public rendering.
- Server URL is `https://mhacks.org/api/mcp/mcp` — must appear verbatim, exactly once as the canonical callout, matching `mcp-docs/INSTRUCTIONS.md:11`.
- Brand style tokens (copy exactly, do not invent new colors): background `#faf9f4` (card) / `#efe9d4` (page band), heading text `#3A4A26` with `font-heading` + `italic`, secondary/body text `rgba(58,74,38,0.6)` with `font-red-hat`, borders `#c8d4a8`.
- The Codex CLI section must include an inline code comment (not user-facing text) flagging it as best-effort / needs verification against current Codex docs, per spec §3 "Codex CLI (new)".

---

### Task 1: Create the `/how-to-mcp` page

**Files:**

- Create: `app/how-to-mcp/page.tsx`

**Interfaces:**

- Consumes: `NavBar` default export from `@/components/navbar`, `SiteFooter` default export from `@/components/site-footer` (both used with no required props in `app/page.tsx`), `Card`/`CardHeader`/`CardContent` named exports from `@/components/ui/card` (used in `app/account/connections/connections-list.tsx`).
- Produces: default-exported `HowToMcpPage` React Server Component, rendered at route `/how-to-mcp`. No other file depends on this yet (not linked from nav).

- [ ] **Step 1: Write the page file**

```tsx
// app/how-to-mcp/page.tsx
//
// Public docs page: how to connect an AI agent (Claude, Codex, or any
// custom MCP client) to the MHacks MCP server. Content is adapted from
// mcp-docs/INSTRUCTIONS.md (kept as the repo-internal reference) with an
// added Codex section and a developer-facing auth explanation. Not linked
// from nav yet — reachable by direct URL only, same as
// app/account/connections currently is.
import NavBar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

const GREEN = "#3A4A26";
const GREEN_SOFT = "rgba(58,74,38,0.6)";
const BORDER = "#c8d4a8";
const CARD_BG = "#faf9f4";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-[#c8d4a8]" style={{ backgroundColor: CARD_BG }}>
      <CardHeader>
        <h2
          className="font-heading italic text-2xl sm:text-3xl tracking-tight"
          style={{ color: GREEN }}
        >
          {title}
        </h2>
      </CardHeader>
      <CardContent
        className="font-red-hat text-[15px] leading-relaxed flex flex-col gap-4"
        style={{ color: GREEN }}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3
        className="font-red-hat font-semibold text-[16px]"
        style={{ color: GREEN }}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code
      className="block whitespace-pre-wrap rounded-md border px-3 py-2 font-mono text-[13px]"
      style={{ borderColor: BORDER, backgroundColor: "#efe9d4", color: GREEN }}
    >
      {children}
    </code>
  );
}

const SERVER_URL = "https://mhacks.org/api/mcp/mcp";

export default function HowToMcpPage() {
  return (
    <div style={{ backgroundColor: "#efe9d4" }}>
      <NavBar />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-32 pb-20 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1
            className="font-heading italic text-4xl sm:text-5xl tracking-tight"
            style={{ color: GREEN }}
          >
            Connect an AI agent to MHacks
          </h1>
          <p className="font-red-hat text-[15px]" style={{ color: GREEN_SOFT }}>
            MHacks has an MCP server that lets you apply through Claude, Codex,
            or any other MCP-capable agent instead of filling out the web form
            by hand. Your agent can read the application schema, save a draft,
            ask you questions, upload your resume, and submit — all tied to your
            real, logged-in MHacks account.
          </p>
        </div>

        <Section title="Server URL">
          <Code>{SERVER_URL}</Code>
          <p className="text-[13px]" style={{ color: GREEN_SOFT }}>
            Use this exact URL when connecting any client below.
          </p>
        </Section>

        <Section title="Connect your client">
          <SubSection title="Claude.ai / Claude Desktop">
            <ol className="list-decimal list-inside flex flex-col gap-1">
              <li>Go to Settings → Connectors → Add custom connector.</li>
              <li>Paste the server URL above.</li>
              <li>
                Claude will open a login page — sign in with your email (MHacks
                uses a one-time code sent to your inbox, no password).
              </li>
              <li>
                Approve the connection when prompted. You&apos;ll see what
                Claude is requesting access to before you approve.
              </li>
            </ol>
          </SubSection>

          <SubSection title="Claude Code">
            <Code>{`claude mcp add --transport http mhacks ${SERVER_URL}`}</Code>
            <p>
              Then inside a session, run <code>/mcp</code>, select{" "}
              <code>mhacks</code>, and authenticate — same email login +
              approval as above.
            </p>
          </SubSection>

          <SubSection title="Codex CLI">
            {/*
              Best-effort: based on Codex CLI's config.toml MCP server
              format as of this assistant's knowledge cutoff (Jan 2026).
              Codex's remote-MCP / OAuth support may have changed since —
              verify this against current Codex docs before treating it as
              authoritative, and update if the config shape or command has
              moved.
            */}
            <p>
              Add the server to <code>~/.codex/config.toml</code>:
            </p>
            <Code>{`[mcp_servers.mhacks]\nurl = "${SERVER_URL}"`}</Code>
            <p>
              Codex will open a browser window to log in (same email
              one-time-code flow) and approve access the first time it calls the
              server.
            </p>
          </SubSection>

          <SubSection title="Other MCP clients">
            <p>
              Any client that supports the MCP Streamable HTTP transport and
              OAuth 2.1 can connect using the same server URL. You&apos;ll go
              through the same email-login-and-approve flow regardless of
              client.
            </p>
          </SubSection>
        </Section>

        <Section title="What you can do">
          <p>Once connected, just talk to your agent normally:</p>
          <ul className="list-disc list-inside flex flex-col gap-1">
            <li>
              &ldquo;Check my MHacks application status&rdquo; — see whether
              you&apos;ve already applied, and if so, its current status.
            </li>
            <li>
              &ldquo;Help me fill out my MHacks application&rdquo; — your agent
              can walk you through each field, save your progress as a draft,
              and come back to it later.
            </li>
            <li>
              &ldquo;Submit my MHacks application&rdquo; — once
              everything&apos;s filled in, your agent submits it for you.
            </li>
          </ul>
        </Section>

        <Section title="How auth works">
          <ul className="list-disc list-inside flex flex-col gap-2">
            <li>
              <strong>
                Your identity comes from your login, not from anything you tell
                the agent.
              </strong>{" "}
              Whatever email you authenticate with is the account the
              application is tied to — an agent can&apos;t submit on someone
              else&apos;s behalf.
            </li>
            <li>
              <strong>Submission is final.</strong> There&apos;s currently no
              MCP tool to edit or withdraw a submitted application, so review it
              with your agent before confirming.
            </li>
            <li>
              <strong>You&apos;ll be asked to explicitly agree</strong> to the
              MLH Code of Conduct, Privacy Policy, and communications terms
              before submission — your agent should read these to you and ask
              for a clear yes/no, not assume.
            </li>
            <li>
              <strong>
                Resume upload usually won&apos;t happen through the agent.
              </strong>{" "}
              Uploading requires the agent to make its own HTTP request with the
              file&apos;s raw bytes — attaching a PDF to the chat only lets the
              agent read it. Coding-agent clients with their own network access
              (Claude Code, Codex, Cursor) can do this; standard Claude.ai /
              Claude Desktop chat can&apos;t, so expect your agent to tell you
              to upload your resume yourself at{" "}
              <a href="/apply" className="underline">
                mhacks.org/apply
              </a>
              , then it&apos;ll confirm it landed before continuing.
            </li>
            <li>
              <strong>Revoking access:</strong> you can see and revoke any
              agent&apos;s access at{" "}
              <a href="/account/connections" className="underline">
                mhacks.org/account/connections
              </a>{" "}
              at any time.
            </li>
          </ul>
        </Section>

        <Section title="Building a custom integration">
          <p>
            Any developer can build their own client against this server. A few
            things to know:
          </p>
          <ul className="list-disc list-inside flex flex-col gap-2">
            <li>
              <strong>Transport:</strong> MCP Streamable HTTP at the server URL
              above.
            </li>
            <li>
              <strong>Auth:</strong> OAuth 2.1, with Supabase Auth as the
              Authorization Server — not this app. An unauthenticated request
              gets a <code>401</code> with a <code>WWW-Authenticate</code>{" "}
              header pointing at{" "}
              <code>/.well-known/oauth-protected-resource</code>, which in turn
              points at Supabase&apos;s own{" "}
              <code>/.well-known/oauth-authorization-server</code> for the
              standard discovery, authorize, and token endpoints.
            </li>
            <li>
              <strong>PKCE is required</strong> on the authorization code flow.
            </li>
            <li>
              <strong>Dynamic Client Registration is off.</strong> A{" "}
              <code>client_id</code> and exact <code>redirect_uri</code> must be
              registered manually — contact the MHacks team to register a client
              for your integration.
            </li>
            <li>
              Access tokens are scoped to <code>application:write</code> and
              identity always comes from the verified token — never from a value
              the client supplies.
            </li>
          </ul>
        </Section>

        <Section title="Trouble connecting?">
          <p>
            Make sure you&apos;re using the exact URL above. If your client asks
            for a &ldquo;Client ID&rdquo; and can&apos;t register automatically,
            that means it doesn&apos;t support dynamic registration — contact
            the MHacks team for a manual client ID.
          </p>
        </Section>
      </div>

      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Confirm the imports match real exports**

Run: `grep -n "export default" components/navbar.tsx components/site-footer.tsx`
Expected: both print `export default function NavBar` / `export default function SiteFooter` (or equivalent default-export line) — confirms the import statements in Step 1 are correct. If either is a named export instead, fix the import in `app/how-to-mcp/page.tsx` accordingly before continuing.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors for `app/how-to-mcp/page.tsx`.

- [ ] **Step 4: Build (typecheck)**

Run: `pnpm build`
Expected: build succeeds, and the route list printed by Next.js includes `/how-to-mcp`.

- [ ] **Step 5: Manual visual check**

Run: `pnpm dev`, then open `http://localhost:3000/how-to-mcp` in a browser.
Expected:

- Page renders with NavBar at top and SiteFooter at bottom, matching the homepage's chrome.
- All 7 sections are present: Server URL, Connect your client (4 subsections: Claude.ai/Desktop, Claude Code, Codex CLI, Other clients), What you can do, How auth works, Building a custom integration, Trouble connecting.
- No layout overflow on mobile width (~375px) — check via browser devtools responsive mode.
- Links to `/apply` and `/account/connections` are present and styled as underlined links.

- [ ] **Step 6: Commit**

```bash
git add app/how-to-mcp/page.tsx
git commit -m "$(cat <<'EOF'
Add /how-to-mcp page for connecting AI agents to MHacks

Public docs page explaining how to connect Claude, Codex, or any custom
MCP client to the MHacks MCP server, adapted from
mcp-docs/INSTRUCTIONS.md with an added Codex section and a
developer-facing auth explanation. Not yet linked from nav pending a UI
decision on placement.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** All 7 content sections from the spec are present (Header, Server URL, Connect your client × 4 clients, What you can do, How auth works, Building a custom integration, Trouble connecting). Public/no-auth confirmed (no `getUser`/`redirect` call in the page). Brand style tokens match the spec's hex values exactly. Codex section has the required inline verification comment. No nav link added, matching the spec's "out of scope."
- **Placeholder scan:** No TBD/TODO; the Codex comment is an intentional, explicit flag (not a placeholder for missing plan content) and the code around it is complete and functional as written.
- **Type consistency:** `Section`/`SubSection`/`Code` are defined once and used consistently by name throughout the same file; no cross-task signature mismatches since this is a single-task plan.
