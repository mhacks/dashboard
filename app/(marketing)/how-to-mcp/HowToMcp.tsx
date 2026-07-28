"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AgentTerminal } from "@/components/landing/AgentTerminal";
import { CopyChip, CommandBlock } from "@/components/landing/CopyBlock";
import { asset } from "@/lib/landing/asset";
import { cn } from "@/lib/utils";
import { INTRO, MACHINE_MD, PROMPTS, SERVER_URL } from "./content";

type Mode = "human" | "machine";
type ClientId = "claude" | "claude-code" | "codex" | "other";

const HAIRLINE = "rgba(58,74,38,0.14)";

/* Dense film grain tile (same recipe as the footer) laid over the backdrop
   photo so it reads like printed paper rather than a raw photograph. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="border-t pt-8" style={{ borderColor: HAIRLINE }}>
      <h2 className="font-display text-3xl font-medium italic tracking-tight text-moss-700 sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li
      className="flex gap-4 border-b py-3.5"
      style={{ borderColor: HAIRLINE }}
    >
      <span className="mt-0.5 font-mono text-[13px] font-semibold tracking-[0.08em] text-moss-700/50">
        {String(n).padStart(2, "0")}
      </span>
      <span className="flex-1">{children}</span>
    </li>
  );
}

const CLIENT_TABS: { id: ClientId; label: string }[] = [
  { id: "claude", label: "Claude.ai" },
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex CLI" },
  { id: "other", label: "Other" },
];

function ClientInstructions({ client }: { client: ClientId }) {
  if (client === "claude") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-moss-700/80">
          Works in Claude.ai on the web and in Claude Desktop.
        </p>
        <ol className="flex flex-col">
          <Step n={1}>Go to Settings → Connectors → Add custom connector.</Step>
          <Step n={2}>Paste the server URL above.</Step>
          <Step n={3}>
            Claude will open a login page. Sign in with your email (MHacks uses
            a one-time code sent to your inbox, no password).
          </Step>
          <Step n={4}>
            Approve the connection when prompted. You&rsquo;ll see what Claude
            is requesting access to before you approve.
          </Step>
        </ol>
      </div>
    );
  }
  if (client === "claude-code") {
    return (
      <div className="flex flex-col gap-4">
        <CommandBlock>{`claude mcp add --transport http mhacks ${SERVER_URL}`}</CommandBlock>
        <p>
          Then inside a session, run{" "}
          <code className="font-mono text-[13px]">/mcp</code>, select{" "}
          <code className="font-mono text-[13px]">mhacks</code>, and
          authenticate with the same email login and approval as Claude.ai.
        </p>
      </div>
    );
  }
  if (client === "codex") {
    return (
      <div className="flex flex-col gap-4">
        <p>
          Add the server to{" "}
          <code className="font-mono text-[13px]">~/.codex/config.toml</code>:
        </p>
        <CommandBlock>{`[mcp_servers.mhacks]\nurl = "${SERVER_URL}"`}</CommandBlock>
        <p>Then log in and approve access with:</p>
        <CommandBlock>codex mcp login mhacks</CommandBlock>
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
      can connect using the same server URL. You&rsquo;ll go through the same
      email-login-and-approve flow regardless of client.
    </p>
  );
}

function ClientTabs() {
  const [client, setClient] = useState<ClientId>("claude");
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle title="Point your client at the server" />
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="MCP client"
      >
        {CLIENT_TABS.map((tab) => {
          const active = tab.id === client;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-cursor="hover"
              onClick={() => setClient(tab.id)}
              className={cn(
                "rounded-pill border px-4 py-1.5 font-mono text-[12px] uppercase tracking-[0.15em] transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-700",
                active
                  ? "border-moss-700 bg-moss-700 text-cream"
                  : "border-[rgba(29,36,18,0.25)] text-moss-700/80 hover:border-moss-700",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <motion.div
        key={client}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="text-[15px] leading-relaxed text-moss-700"
      >
        <ClientInstructions client={client} />
      </motion.div>
    </section>
  );
}

const AUTH_NOTES: { lead: string; body: React.ReactNode }[] = [
  {
    lead: "Your identity comes from your login, not from anything you tell the agent.",
    body: "Whatever email you authenticate with is the account the application is tied to. An agent can't submit on someone else's behalf.",
  },
  {
    lead: "Submission is final.",
    body: "There's currently no MCP tool to edit or withdraw a submitted application, so review it with your agent before confirming.",
  },
  {
    lead: "You'll be asked to explicitly agree",
    body: "to the MLH Code of Conduct, Privacy Policy, and communications terms before submission. Your agent should read these to you and ask for a clear yes/no, not assume.",
  },
  {
    lead: "Resume upload usually won't happen through the agent.",
    body: (
      <>
        Uploading requires the agent to make its own HTTP request with the
        file&rsquo;s raw bytes. Attaching a PDF to the chat only lets the agent
        read it. Coding-agent clients with their own network access (Claude
        Code, Codex, Cursor) can do this; standard Claude.ai / Claude Desktop
        chat can&rsquo;t, so expect your agent to tell you to upload your resume
        yourself at{" "}
        <a
          href="https://www.mhacks.org/apply"
          data-cursor="hover"
          className="text-moss-700 underline underline-offset-2"
        >
          mhacks.org/apply
        </a>
        , then it&rsquo;ll confirm it landed before continuing.
      </>
    ),
  },
  {
    lead: "You can revoke access at any time.",
    body: (
      <>
        See and revoke any agent&rsquo;s access at{" "}
        <a
          href="https://www.mhacks.org/account/connections"
          data-cursor="hover"
          className="text-moss-700 underline underline-offset-2"
        >
          mhacks.org/account/connections
        </a>
        .
      </>
    ),
  },
];

function HumanMode() {
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-8">
        <Rise className="flex flex-col gap-3">
          <h1 className="font-display text-4xl font-medium italic leading-[0.98] tracking-tight text-moss-700 sm:text-5xl lg:text-6xl">
            Connect an AI agent to MHacks
          </h1>
          <p className="max-w-2xl text-[16px] leading-relaxed text-moss-700/80">
            {INTRO}
          </p>
        </Rise>

        <Rise delay={0.1}>
          <AgentTerminal />
        </Rise>

        <Rise delay={0.15} className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-moss-700/50">
            Server URL: use it exactly as written, in any client below
          </p>
          <CommandBlock emphasized>{SERVER_URL}</CommandBlock>
        </Rise>
      </div>

      <ClientTabs />

      <section className="flex flex-col gap-6">
        <SectionTitle title="Just talk to your agent" />
        <div className="flex flex-col">
          {PROMPTS.map((p) => (
            <Rise key={p.quote}>
              <div
                className="flex flex-col gap-1.5 border-b px-2 py-5 transition-colors duration-300 hover:bg-moss-700/[0.06] md:px-4"
                style={{ borderColor: HAIRLINE }}
              >
                <p className="font-display text-xl font-medium italic tracking-tight text-moss-700 sm:text-2xl">
                  &ldquo;{p.quote}&rdquo;
                </p>
                <p className="max-w-xl text-[14px] leading-relaxed text-moss-700/80">
                  {p.detail}
                </p>
              </div>
            </Rise>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionTitle title="How auth works" />
        <ul className="flex flex-col gap-5">
          {AUTH_NOTES.map((note, i) => (
            <Rise key={i}>
              <li className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-1 font-mono text-[13px] text-moss-700/50"
                >
                  ✳
                </span>
                <p className="flex-1 text-[15px] leading-relaxed text-moss-700/80">
                  <strong className="font-semibold text-moss-700">
                    {note.lead}
                  </strong>{" "}
                  {note.body}
                </p>
              </li>
            </Rise>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MachineMode() {
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-xl text-[15px] leading-relaxed text-moss-700/80">
        Copy this markdown and paste it into your agent (Claude Code, Codex, or
        any MCP-capable client). It has everything your agent needs to connect
        and apply; from there, just follow your agent&rsquo;s instructions.
      </p>
      <div
        className="flex items-center justify-between gap-3 border-b pb-4"
        style={{ borderColor: HAIRLINE }}
      >
        <span className="font-mono text-[12px] tracking-[0.08em] text-moss-500">
          how-to-mcp.md
        </span>
        <CopyChip text={MACHINE_MD} label="copy markdown" />
      </div>
      <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-[1.75] text-moss-700">
        {MACHINE_MD}
      </pre>
    </div>
  );
}

/**
 * Paxel-style document page: the garden photo runs full-bleed behind a
 * centered paper sheet. `human` renders the typeset guide with copyable
 * commands; `machine` renders the same content as one plain markdown file.
 */
export function HowToMcp() {
  const [mode, setMode] = useState<Mode>("human");

  return (
    <div data-nav-theme="light" className="relative">
      {/* Backdrop: aerial terraces behind the same frosted veil as the hero
          (blur values match HeroReveal's, painted on an oversized plate so
          the blur never samples past the edges). Fixed so the paper scrolls
          over it. */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -inset-[12%] [filter:blur(7px)_brightness(0.84)_saturate(1.1)] md:[filter:blur(22px)_brightness(0.82)_saturate(1.12)_contrast(1.04)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset("/footer/footer-pastel.jpg")}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(29,36,18,0.2) 0%, rgba(29,36,18,0.05) 40%, rgba(29,36,18,0.25) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: GRAIN,
            backgroundSize: "240px 240px",
            mixBlendMode: "overlay",
            opacity: 0.55,
          }}
        />
      </div>

      <div className="px-4 pb-28 pt-28 sm:px-6 md:pt-32">
        {/* The paper */}
        <div className="relative mx-auto w-full max-w-[820px] rounded-[22px] bg-[#FBFAF4] shadow-[0_48px_120px_-32px_rgba(29,36,18,0.6)] ring-1 ring-white/60">
          {/* Same dotted tooth as the FAQ sheet */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[22px]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(58,74,38,0.12) 1px, transparent 1.4px)",
              backgroundSize: "26px 26px",
            }}
          />

          <div className="relative flex flex-col gap-10 px-6 py-10 sm:px-12 sm:py-14 md:px-16">
            {/* Mode toggle — sits at the top of the paper and scrolls away
                with it */}
            <div className="-mb-4 flex justify-end">
              <div
                role="tablist"
                aria-label="Reading mode"
                className="inline-flex rounded-pill border border-[rgba(29,36,18,0.14)] bg-[rgba(251,250,244,0.85)] p-1 shadow-e-2 backdrop-blur-md"
              >
                {(["human", "machine"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    data-cursor="hover"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-pill px-3.5 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors",
                      mode === m
                        ? "bg-moss-700 text-cream"
                        : "text-moss-700/70 hover:text-moss-700",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {mode === "human" ? <HumanMode /> : <MachineMode />}
          </div>
        </div>
      </div>
    </div>
  );
}
