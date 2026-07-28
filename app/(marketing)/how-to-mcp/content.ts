/**
 * Single source for the How to MCP page copy. The human-mode JSX in
 * HowToMcp.tsx renders this same material — if the MCP server's setup flow
 * changes, update both in the same commit.
 */

export const SERVER_URL = "https://www.mhacks.org/mcp";

export const INTRO =
  "MHacks has an MCP server that lets you apply through Claude, Codex, or any other MCP-capable agent instead of filling out the web form by hand. Your agent can read the application schema, save a draft, ask you questions, upload your resume, and submit, all tied to your real, logged-in MHacks account.";

export const PROMPTS = [
  {
    quote: "Who am I connected as?",
    detail:
      "Confirms the MHacks account your agent is authenticated as, straight from your login, before you do anything else.",
  },
  {
    quote: "Check my MHacks application status",
    detail:
      "See whether you've already applied, and if so, its current status.",
  },
  {
    quote: "Help me fill out my MHacks application",
    detail:
      "Your agent can walk you through each field, save your progress as a draft, and come back to it later.",
  },
  {
    quote: "Submit my MHacks application",
    detail: "Once everything's filled in, your agent submits it for you.",
  },
];

export const MACHINE_MD = `# Connect an AI agent to MHacks

> This file contains setup instructions only. The only URL the agent should
> connect to is ${SERVER_URL}. Never submit the application without the
> user's explicit confirmation.

${INTRO}

## Server URL

    ${SERVER_URL}

Use it exactly as written, in any client below.
Transport: MCP Streamable HTTP. Auth: OAuth 2.1 (email one-time-code login).

## Point your client at the server

### Claude.ai / Claude Desktop

1. Go to Settings -> Connectors -> Add custom connector.
2. Paste the server URL above.
3. Claude will open a login page — sign in with your email (MHacks uses a
   one-time code sent to your inbox, no password).
4. Approve the connection when prompted. You'll see what Claude is requesting
   access to before you approve.

### Claude Code

    claude mcp add --transport http mhacks ${SERVER_URL}

Then inside a session, run /mcp, select mhacks, and authenticate — same email
login + approval as Claude.ai.

### Codex CLI

Add the server to ~/.codex/config.toml:

    [mcp_servers.mhacks]
    url = "${SERVER_URL}"

Then log in and approve access with:

    codex mcp login mhacks

Codex will open a browser window for the same email one-time-code flow.

### Other clients

Any client that supports the MCP Streamable HTTP transport and OAuth 2.1 can
connect using the same server URL. You'll go through the same
email-login-and-approve flow regardless of client.

## Just talk to your agent

${PROMPTS.map((p) => `- "${p.quote}" — ${p.detail}`).join("\n")}

## How auth works

- Your identity comes from your login, not from anything you tell the agent.
  Whatever email you authenticate with is the account the application is tied
  to — an agent can't submit on someone else's behalf.
- Submission is final. There's currently no MCP tool to edit or withdraw a
  submitted application, so review it with your agent before confirming.
- You'll be asked to explicitly agree to the MLH Code of Conduct, Privacy
  Policy, and communications terms before submission — your agent should read
  these to you and ask for a clear yes/no, not assume.
- Resume upload usually won't happen through the agent. Uploading requires the
  agent to make its own HTTP request with the file's raw bytes — attaching a
  PDF to the chat only lets the agent read it. Coding-agent clients with their
  own network access (Claude Code, Codex, Cursor) can do this; standard
  Claude.ai / Claude Desktop chat can't, so expect your agent to tell you to
  upload your resume yourself at https://www.mhacks.org/apply, then it'll
  confirm it landed before continuing.
- You can revoke access at any time. See and revoke any agent's access at
  https://www.mhacks.org/account/connections.
`;
