import { EVENT } from "@/lib/config/event";

/**
 * Single source for the How to MCP page copy. Human-mode JSX in HowToMcp.tsx
 * renders from these exports; MACHINE_MD is generated from the same data.
 */

export const SERVER_URL = "https://www.mhacks.org/mcp";

export const INTRO = `${EVENT.name} has an MCP server that lets you apply through Claude, Codex, or any other MCP-capable agent instead of filling out the web form by hand. Your agent can read the application schema, save a draft, ask you questions, upload your resume, and submit, all tied to your real, logged-in ${EVENT.name} account.`;

export const PROMPTS = [
  {
    quote: "Who am I connected as?",
    detail: `Confirms the ${EVENT.name} account your agent is authenticated as, straight from your login, before you do anything else.`,
  },
  {
    quote: `Check my ${EVENT.name} application status`,
    detail:
      "See whether you've already applied, and if so, its current status.",
  },
  {
    quote: `Help me fill out my ${EVENT.name} application`,
    detail:
      "Your agent can walk you through each field, save your progress as a draft, and come back to it later.",
  },
  {
    quote: `Submit my ${EVENT.name} application`,
    detail: "Once everything's filled in, your agent submits it for you.",
  },
] as const;

export type AuthNotePart = string | { text: string; href: string };

export interface AuthNote {
  lead: string;
  parts: AuthNotePart[];
}

export const AUTH_NOTES: AuthNote[] = [
  {
    lead: "Your identity comes from your login, not from anything you tell the agent.",
    parts: [
      "Whatever email you authenticate with is the account the application is tied to. An agent can't submit on someone else's behalf.",
    ],
  },
  {
    lead: "Submission is final.",
    parts: [
      "There's currently no MCP tool to edit or withdraw a submitted application, so review it with your agent before confirming.",
    ],
  },
  {
    lead: "You'll be asked to explicitly agree",
    parts: [
      "to the MLH Code of Conduct, Privacy Policy, and communications terms before submission. Your agent should read these to you and ask for a clear yes/no, not assume.",
    ],
  },
  {
    lead: "Resume upload usually won't happen through the agent.",
    parts: [
      "Uploading requires the agent to make its own HTTP request with the file's raw bytes. Attaching a PDF to the chat only lets the agent read it. Coding-agent clients with their own network access (Claude Code, Codex, Cursor) can do this; standard Claude.ai / Claude Desktop chat can't, so expect your agent to tell you to upload your resume yourself at ",
      { text: "mhacks.org/apply", href: "https://www.mhacks.org/apply" },
      ", then it'll confirm it landed before continuing.",
    ],
  },
  {
    lead: "You can revoke access at any time.",
    parts: [
      "See and revoke any agent's access at ",
      {
        text: "mhacks.org/account/connections",
        href: "https://www.mhacks.org/account/connections",
      },
      ".",
    ],
  },
];

export type ClientId = "claude" | "claude-code" | "codex" | "other";

export type RichSegment = string | { code: string };

export type ClientBlock =
  | { type: "p"; text: string }
  | { type: "p-rich"; segments: RichSegment[] }
  | { type: "steps"; intro?: string; items: string[] }
  | { type: "cmd"; template: string };

export interface ClientGuide {
  label: string;
  mdHeading: string;
  blocks: ClientBlock[];
}

export const CLIENT_GUIDES: Record<ClientId, ClientGuide> = {
  claude: {
    label: "Claude.ai",
    mdHeading: "Claude.ai / Claude Desktop",
    blocks: [
      {
        type: "p",
        text: "Works in Claude.ai on the web and in Claude Desktop.",
      },
      {
        type: "steps",
        items: [
          "Go to Settings → Connectors → Add custom connector.",
          "Paste the server URL above.",
          `Claude will open a login page — sign in with your email (${EVENT.name} uses a one-time code sent to your inbox, no password).`,
          "Approve the connection when prompted. You'll see what Claude is requesting access to before you approve.",
        ],
      },
    ],
  },
  "claude-code": {
    label: "Claude Code",
    mdHeading: "Claude Code",
    blocks: [
      {
        type: "cmd",
        template: "claude mcp add --transport http mhacks ${SERVER_URL}",
      },
      {
        type: "p-rich",
        segments: [
          "Then inside a session, run ",
          { code: "/mcp" },
          ", select ",
          { code: "mhacks" },
          ", and authenticate — same email login + approval as Claude.ai.",
        ],
      },
    ],
  },
  codex: {
    label: "Codex CLI",
    mdHeading: "Codex CLI",
    blocks: [
      {
        type: "p",
        text: "Add the server to ~/.codex/config.toml:",
      },
      {
        type: "cmd",
        template: '[mcp_servers.mhacks]\nurl = "${SERVER_URL}"',
      },
      { type: "p", text: "Then log in and approve access with:" },
      { type: "cmd", template: "codex mcp login mhacks" },
      {
        type: "p",
        text: "Codex will open a browser window for the same email one-time-code flow.",
      },
    ],
  },
  other: {
    label: "Other",
    mdHeading: "Other clients",
    blocks: [
      {
        type: "p",
        text: "Any client that supports the MCP Streamable HTTP transport and OAuth 2.1 can connect using the same server URL. You'll go through the same email-login-and-approve flow regardless of client.",
      },
    ],
  },
};

export const CLIENT_IDS = Object.keys(CLIENT_GUIDES) as ClientId[];

function expandTemplate(template: string): string {
  return template.replaceAll("${SERVER_URL}", SERVER_URL);
}

function richSegmentsPlain(segments: RichSegment[]): string {
  return segments
    .map((segment) => (typeof segment === "string" ? segment : segment.code))
    .join("");
}

function clientBlockMarkdown(block: ClientBlock): string {
  switch (block.type) {
    case "p":
      return block.text;
    case "p-rich":
      return richSegmentsPlain(block.segments);
    case "cmd":
      return `\n    ${expandTemplate(block.template)}\n`;
    case "steps":
      return block.items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  }
}

function clientGuideMarkdown(guide: ClientGuide): string {
  const body = guide.blocks
    .map((block) => {
      if (block.type === "steps") {
        return clientBlockMarkdown(block);
      }
      if (block.type === "cmd") {
        return expandTemplate(block.template);
      }
      return clientBlockMarkdown(block);
    })
    .join("\n\n");

  if (guide.blocks.some((block) => block.type === "steps")) {
    return body;
  }
  return body;
}

function clientSetupMarkdown(): string {
  return CLIENT_IDS.map((id) => {
    const guide = CLIENT_GUIDES[id];
    const body = clientGuideMarkdown(guide);
    if (guide.blocks.some((block) => block.type === "steps")) {
      return `### ${guide.mdHeading}\n\n${body}`;
    }
    if (guide.blocks.some((block) => block.type === "cmd")) {
      const parts: string[] = [`### ${guide.mdHeading}`, ""];
      for (const block of guide.blocks) {
        if (block.type === "p" || block.type === "p-rich") {
          parts.push(clientBlockMarkdown(block), "");
        } else if (block.type === "cmd") {
          parts.push(`    ${expandTemplate(block.template)}`, "");
        }
      }
      return parts.join("\n").trimEnd();
    }
    return `### ${guide.mdHeading}\n\n${body}`;
  }).join("\n\n");
}

function authNotePlainText(note: AuthNote): string {
  return note.parts
    .map((part) => (typeof part === "string" ? part : part.href))
    .join("");
}

export const MACHINE_MD = `# Connect an AI agent to ${EVENT.name}

> This file contains setup instructions only. The only URL the agent should
> connect to is ${SERVER_URL}. Never submit the application without the
> user's explicit confirmation.

${INTRO}

## Server URL

    ${SERVER_URL}

Use it exactly as written, in any client below.
Transport: MCP Streamable HTTP. Auth: OAuth 2.1 (email one-time-code login).

## Point your client at the server

${clientSetupMarkdown()}

## Just talk to your agent

${PROMPTS.map((p) => `- "${p.quote}" — ${p.detail}`).join("\n")}

## How auth works

${AUTH_NOTES.map((note) => `- ${note.lead} ${authNotePlainText(note)}`).join("\n")}
`;
