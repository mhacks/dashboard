"use client";

// Public docs page: how to connect an AI agent (Claude, Codex, or any
// custom MCP client) to the MHacks MCP server. Content is adapted from
// mcp-docs/INSTRUCTIONS.md (kept as the repo-internal reference) with an
// added Codex section and a developer-facing auth explanation. Linked
// from the navbar as "MCP".
//
// Visual language mirrors the landing page: moss-on-paper, Red Hat
// throughout (headings included), Geist Mono for everything the machine
// says, and dotted leaders from the Timeline section. A photo fades in
// down the side gutters (see GutterPhoto), leaving the center column
// clear for content. The one dark element is the hero terminal — a
// staged agent session, since the page's subject is literally an agent
// talking to this server.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import NavBar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";

const MOSS = "#3A4A26";
const MOSS_SOFT = "rgba(58,74,38,0.8)";
const MOSS_FAINT = "rgba(58,74,38,0.45)";
const HAIRLINE = "rgba(58,74,38,0.14)";
const LEADER = "rgba(58,74,38,0.25)";
const CREAM = "#efe9d4";
const PINE = "#1c2513"; // terminal panel — the page's single dark surface
const PARCHMENT = "#ebe4ce"; // terminal foreground, same as hero title
const SAGE = "#bec59b";

const SERVER_URL = "https://www.mhacks.org/mcp";
const EASE = [0.25, 0.1, 0.25, 1] as const;

/* ── shared building blocks ─────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className,
  onLoad = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  /** Hero pieces animate on mount — the server URL must never wait on a
      scroll trigger. Everything below the fold reveals as it scrolls in. */
  onLoad?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      {...(onLoad
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: "-40px" },
          })}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div
      className="flex flex-col gap-3 border-t pt-8"
      style={{ borderColor: HAIRLINE }}
    >
      <h2
        className="font-red-hat italic text-3xl sm:text-4xl tracking-tight"
        style={{ color: MOSS }}
      >
        {title}
      </h2>
    </div>
  );
}

function CopyButton({
  text,
  emphasized = false,
}: {
  text: string;
  emphasized?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);
  const style = copied
    ? emphasized
      ? { backgroundColor: CREAM, borderColor: CREAM, color: MOSS }
      : { backgroundColor: MOSS, borderColor: MOSS, color: CREAM }
    : emphasized
      ? { borderColor: "rgba(239,233,212,0.5)", color: CREAM }
      : { borderColor: LEADER, color: MOSS_SOFT };
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => setCopied(true));
      }}
      className="shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3A4A26]"
      style={style}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}

function CodeBlock({
  children,
  emphasized = false,
}: {
  children: string;
  /** The one call site the page most wants a visitor's eye to land on —
      a solid moss fill instead of the usual cream, so it reads as the
      main focal point rather than blending into the section. */
  emphasized?: boolean;
}) {
  return (
    <div
      className={
        emphasized
          ? "flex items-center gap-3 rounded-lg border px-4 py-3.5 shadow-[0_12px_32px_-12px_rgba(58,74,38,0.55)]"
          : "flex items-center gap-3 rounded-lg border px-4 py-3"
      }
      style={
        emphasized
          ? { borderColor: MOSS, backgroundColor: MOSS }
          : { borderColor: LEADER, backgroundColor: CREAM }
      }
    >
      <code
        className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed sm:text-[14px]"
        style={{ color: emphasized ? CREAM : MOSS }}
      >
        {children}
      </code>
      <CopyButton text={children} emphasized={emphasized} />
    </div>
  );
}

/* ── hero terminal — the page's signature ───────────────────────────── */

const TRANSCRIPT: {
  kind: "user" | "tool" | "agent" | "prompt";
  text: string;
}[] = [
  { kind: "user", text: "help me apply to MHacks" },
  { kind: "tool", text: "mhacks · get_application_schema" },
  { kind: "tool", text: "mhacks · save_application_draft" },
  {
    kind: "agent",
    text: "Draft saved. I still need your school and t-shirt size — then we can review the MLH terms together before submitting.",
  },
  { kind: "prompt", text: "" },
];

function TranscriptLine({ line }: { line: (typeof TRANSCRIPT)[number] }) {
  if (line.kind === "user" || line.kind === "prompt") {
    return (
      <p className="flex gap-2">
        <span style={{ color: SAGE }}>❯</span>
        <span style={{ color: PARCHMENT }}>
          {line.text}
          {line.kind === "prompt" && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1.1em] w-[7px] translate-y-[0.2em]"
              style={{
                backgroundColor: SAGE,
                animation: "blink 1.2s step-end infinite",
              }}
            />
          )}
        </span>
      </p>
    );
  }
  if (line.kind === "tool") {
    return (
      <p className="flex gap-2" style={{ color: "rgba(235,228,206,0.55)" }}>
        <span style={{ color: SAGE }}>✳</span>
        <span>
          {line.text} … <span style={{ color: SAGE }}>ok</span>
        </span>
      </p>
    );
  }
  return (
    <p className="pl-5" style={{ color: PARCHMENT }}>
      {line.text}
    </p>
  );
}

function HeroTerminal() {
  const reduced = useReducedMotion();
  return (
    <div
      className="overflow-hidden rounded-xl border shadow-[0_32px_80px_-32px_rgba(31,42,22,0.55)]"
      style={{ backgroundColor: PINE, borderColor: "rgba(235,228,206,0.14)" }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: "rgba(235,228,206,0.1)" }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "rgba(235,228,206,0.22)" }}
          />
        ))}
        <span
          className="ml-2 font-mono text-[11px] tracking-[0.12em]"
          style={{ color: "rgba(235,228,206,0.45)" }}
        >
          agent — {SERVER_URL.replace("https://", "")}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-4 font-mono text-[12px] leading-relaxed sm:px-5 sm:text-[13px]">
        {TRANSCRIPT.map((line, i) => (
          <motion.div
            key={i}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 + i * 0.45, ease: EASE }}
          >
            <TranscriptLine line={line} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── connect: one client at a time ──────────────────────────────────── */

const CLIENTS = [
  { id: "claude", label: "Claude.ai" },
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex CLI" },
  { id: "other", label: "Other" },
] as const;

type ClientId = (typeof CLIENTS)[number]["id"];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li
      className="flex gap-4 border-b py-3.5"
      style={{ borderColor: HAIRLINE }}
    >
      <span
        className="mt-0.5 font-mono text-[13px] font-semibold tracking-[0.08em]"
        style={{ color: MOSS_FAINT }}
      >
        {String(n).padStart(2, "0")}
      </span>
      <span className="flex-1">{children}</span>
    </li>
  );
}

function ClientPanel({ client }: { client: ClientId }) {
  if (client === "claude") {
    return (
      <div className="flex flex-col gap-2">
        <p style={{ color: MOSS_SOFT }}>
          Works in Claude.ai on the web and in Claude Desktop.
        </p>
        <ol className="flex flex-col">
          <Step n={1}>Go to Settings → Connectors → Add custom connector.</Step>
          <Step n={2}>Paste the server URL above.</Step>
          <Step n={3}>
            Claude will open a login page — sign in with your email (MHacks uses
            a one-time code sent to your inbox, no password).
          </Step>
          <Step n={4}>
            Approve the connection when prompted. You&apos;ll see what Claude is
            requesting access to before you approve.
          </Step>
        </ol>
      </div>
    );
  }
  if (client === "claude-code") {
    return (
      <div className="flex flex-col gap-4">
        <CodeBlock>{`claude mcp add --transport http mhacks ${SERVER_URL}`}</CodeBlock>
        <p>
          Then inside a session, run{" "}
          <code className="font-mono text-[13px]">/mcp</code>, select{" "}
          <code className="font-mono text-[13px]">mhacks</code>, and
          authenticate — same email login + approval as Claude.ai.
        </p>
      </div>
    );
  }
  if (client === "codex") {
    return (
      <div className="flex flex-col gap-4">
        {/*
          Best-effort: based on Codex CLI's config.toml MCP server
          format as of this assistant's knowledge cutoff (Jan 2026).
          Codex's remote-MCP / OAuth support may have changed since —
          verify this against current Codex docs before treating it as
          authoritative, and update if the config shape or command has
          moved.
        */}
        <p>
          Add the server to{" "}
          <code className="font-mono text-[13px]">~/.codex/config.toml</code>:
        </p>
        <CodeBlock>{`[mcp_servers.mhacks]\nurl = "${SERVER_URL}"`}</CodeBlock>
        <p>Then log in and approve access with:</p>
        <CodeBlock>{`codex mcp login mhacks`}</CodeBlock>
        <p>
          Codex will open a browser window for the same email one-time-code
          flow.
        </p>
      </div>
    );
  }
  return (
    <p>
      Any client that supports the MCP Streamable HTTP transport and OAuth 2.1
      can connect using the same server URL. You&apos;ll go through the same
      email-login-and-approve flow regardless of client.
    </p>
  );
}

function ConnectSection() {
  const [client, setClient] = useState<ClientId>("claude");
  const reduced = useReducedMotion();
  return (
    <section className="flex flex-col gap-6">
      <SectionHeading title="Point your client at the server" />
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="MCP client"
      >
        {CLIENTS.map((c) => {
          const active = c.id === client;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setClient(c.id)}
              className="rounded-full border px-4 py-1.5 font-mono text-[12px] uppercase tracking-[0.15em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3A4A26]"
              style={
                active
                  ? { backgroundColor: MOSS, borderColor: MOSS, color: CREAM }
                  : { borderColor: LEADER, color: MOSS_SOFT }
              }
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <motion.div
        key={client}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="font-red-hat text-[15px] leading-relaxed"
        style={{ color: MOSS }}
      >
        <ClientPanel client={client} />
      </motion.div>
    </section>
  );
}

/* ── what you can do: the prompts are the content ───────────────────── */

const PROMPTS = [
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

function PromptsSection() {
  return (
    <section className="flex flex-col gap-6">
      <SectionHeading title="Just talk to your agent" />
      <div className="flex flex-col">
        {PROMPTS.map((p) => (
          <Reveal key={p.quote}>
            <div
              className="flex flex-col gap-1.5 border-b px-2 py-5 transition-colors duration-300 hover:bg-[rgba(58,74,38,0.06)] md:px-4"
              style={{ borderColor: HAIRLINE }}
            >
              <p
                className="font-red-hat italic text-xl sm:text-2xl tracking-tight"
                style={{ color: MOSS }}
              >
                “{p.quote}”
              </p>
              <p
                className="font-red-hat max-w-xl text-[14px] leading-relaxed"
                style={{ color: MOSS_SOFT }}
              >
                {p.detail}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── how auth works ─────────────────────────────────────────────────── */

const AUTH_FACTS: { lead: string; body: React.ReactNode }[] = [
  {
    lead: "Your identity comes from your login, not from anything you tell the agent.",
    body: "Whatever email you authenticate with is the account the application is tied to — an agent can't submit on someone else's behalf.",
  },
  {
    lead: "Submission is final.",
    body: "There's currently no MCP tool to edit or withdraw a submitted application, so review it with your agent before confirming.",
  },
  {
    lead: "You'll be asked to explicitly agree",
    body: "to the MLH Code of Conduct, Privacy Policy, and communications terms before submission — your agent should read these to you and ask for a clear yes/no, not assume.",
  },
  {
    lead: "Resume upload usually won't happen through the agent.",
    body: (
      <>
        Uploading requires the agent to make its own HTTP request with the
        file&apos;s raw bytes — attaching a PDF to the chat only lets the agent
        read it. Coding-agent clients with their own network access (Claude
        Code, Codex, Cursor) can do this; standard Claude.ai / Claude Desktop
        chat can&apos;t, so expect your agent to tell you to upload your resume
        yourself at{" "}
        <a
          href="/apply"
          className="underline underline-offset-2"
          style={{ color: MOSS }}
        >
          mhacks.org/apply
        </a>
        , then it&apos;ll confirm it landed before continuing.
      </>
    ),
  },
  {
    lead: "You can revoke access at any time.",
    body: (
      <>
        See and revoke any agent&apos;s access at{" "}
        <a
          href="/account/connections"
          className="underline underline-offset-2"
          style={{ color: MOSS }}
        >
          mhacks.org/account/connections
        </a>
        .
      </>
    ),
  },
];

function AuthSection() {
  return (
    <section className="flex flex-col gap-6">
      <SectionHeading title="How auth works" />
      <ul className="flex flex-col gap-5">
        {AUTH_FACTS.map((f, i) => (
          <Reveal key={i}>
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-1 font-mono text-[13px]"
                style={{ color: MOSS_FAINT }}
              >
                ✳
              </span>
              <p
                className="font-red-hat flex-1 text-[15px] leading-relaxed"
                style={{ color: MOSS_SOFT }}
              >
                <strong className="font-semibold" style={{ color: MOSS }}>
                  {f.lead}
                </strong>{" "}
                {f.body}
              </p>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

/* ── gutter photo ────────────────────────────────────────────────────── */

// The clear band must never run narrower than the content column, or text
// spills past it into the photo. The content column is `max-w-3xl` (768px)
// with `sm:px-6` (24px/side = 48px total) padding — the gutter photo only
// ever renders at sm and up, so those are the only numbers that matter
// here. MIN_GAP is extra breathing room on top of that: pure cream between
// the text and the photo, never the two touching edge-to-edge. Below the
// viewport where that gap can be honored, the photo clamps to 0 and just
// isn't shown — "disappear" is the fallback, not the padding. Fixed
// position (not scroll-linked) since a static photo doesn't need the
// flowers' scroll-driven redraw.
const MIN_GAP = 32;
const GUTTER_WIDTH = `max(0px, calc((100vw - min(768px, calc(100vw - 48px))) / 2 - ${MIN_GAP}px))`;

function GutterPhoto() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 hidden sm:block"
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: GUTTER_WIDTH,
          backgroundImage: "url(/idk_what_this_is.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "left center",
          opacity: 0.55,
        }}
      />
      <div
        className="absolute inset-y-0 right-0"
        style={{
          width: GUTTER_WIDTH,
          backgroundImage: "url(/idk_what_this_is.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "right center",
          opacity: 0.55,
        }}
      />
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────────── */

export default function HowToMcpPage() {
  return (
    <div className="relative">
      <GutterPhoto />
      <NavBar forceShowLogo />

      <div className="mx-auto flex max-w-3xl flex-col gap-16 px-4 pt-32 pb-24 sm:px-6">
        {/* ── Hero ── */}
        <div className="relative flex flex-col gap-8">
          {/* Soft bloom behind the title — a quiet nod to the landing hero. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 -z-[1] h-72 w-[36rem] max-w-[90vw] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(255,170,216,0.28), rgba(190,220,255,0.22) 55%, transparent 72%)",
            }}
          />
          <Reveal onLoad className="flex flex-col gap-3">
            <h1
              className="font-red-hat italic text-4xl leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: MOSS }}
            >
              Connect an AI agent to&nbsp;MHacks
            </h1>
            <p
              className="font-red-hat max-w-2xl text-[16px] leading-relaxed"
              style={{ color: MOSS_SOFT }}
            >
              MHacks has an MCP server that lets you apply through Claude,
              Codex, or any other MCP-capable agent instead of filling out the
              web form by hand. Your agent can read the application schema, save
              a draft, ask you questions, upload your resume, and submit — all
              tied to your real, logged-in MHacks account.
            </p>
          </Reveal>

          <Reveal onLoad delay={0.1}>
            <HeroTerminal />
          </Reveal>

          <Reveal onLoad delay={0.15} className="flex flex-col gap-2">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ color: MOSS_FAINT }}
            >
              Server URL — use it exactly as written, in any client below
            </p>
            <CodeBlock emphasized>{SERVER_URL}</CodeBlock>
          </Reveal>
        </div>

        <ConnectSection />
        <PromptsSection />
        <AuthSection />
      </div>
      <SiteFooter />
    </div>
  );
}
