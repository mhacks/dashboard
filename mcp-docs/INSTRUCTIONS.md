# Apply to MHacks with an AI agent

MHacks has an MCP server that lets you apply through Claude (or any other
MCP-capable agent) instead of filling out the web form by hand. Your
agent can read the application schema, save a draft, ask you questions,
upload your resume, and submit — all tied to your real, logged-in MHacks
account.

## Connect

**Server URL:** `https://mhacks.org/api/mcp/mcp`

### Claude.ai / Claude Desktop

1. Go to **Settings → Connectors → Add custom connector**.
2. Paste the server URL above.
3. Claude will open a login page — sign in with your email (MHacks uses
   a one-time code sent to your inbox, no password).
4. Approve the connection when prompted. You'll see what Claude is
   requesting access to before you approve.

### Claude Code

```bash
claude mcp add --transport http mhacks https://mhacks.org/api/mcp/mcp
```

Then inside a session, run `/mcp`, select `mhacks`, and authenticate —
same email login + approval as above.

### Other MCP clients (Cursor, etc.)

Any client that supports the MCP Streamable HTTP transport and OAuth 2.1
can connect using the same server URL. You'll go through the same
email-login-and-approve flow regardless of client.

## What you can do

Once connected, just talk to your agent normally:

- **"Check my MHacks application status"** — see whether you've already
  applied, and if so, its current status.
- **"Help me fill out my MHacks application"** — your agent can walk you
  through each field, save your progress as a draft, and come back to it
  later.
- **"Submit my MHacks application"** — once everything's filled in, your
  agent submits it for you.

## A few things to know

- **Your identity comes from your login, not from anything you tell the
  agent.** Whatever email you authenticate with is the account the
  application is tied to — an agent can't submit on someone else's
  behalf.
- **Submission is final.** There's currently no MCP tool to edit or
  withdraw a submitted application, so review it with your agent before
  confirming.
- **You'll be asked to explicitly agree** to the MLH Code of Conduct,
  Privacy Policy, and communications terms before submission — your
  agent should read these to you and ask for a clear yes/no, not assume.
- **Resume upload usually won't happen through the agent.** Uploading
  requires the agent to make its own HTTP request with the file's raw
  bytes — attaching a PDF to the chat is not the same thing as that, since
  it just lets the agent _read_ it. Coding-agent-style clients with their
  own terminal/network access (Claude Code, Cursor) can genuinely do this.
  **Standard Claude.ai and Claude Desktop chat can't** — expect your
  agent to tell you to upload your resume yourself at
  [mhacks.org/apply](https://mhacks.org/apply), then it'll confirm it
  landed before continuing.
- **Revoking access:** you can see and revoke any agent's access at
  [mhacks.org/account/connections](https://mhacks.org/account/connections)
  at any time.

## Trouble connecting?

Make sure you're using the exact URL above. If your client asks for a
"Client ID" and can't register automatically, that means it doesn't
support dynamic registration — contact the MHacks team for a manual
client ID.
