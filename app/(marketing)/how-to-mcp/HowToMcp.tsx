"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AgentTerminal } from "@/components/landing/AgentTerminal";
import { PillTabGroup } from "@/components/landing/PillTabGroup";
import { CopyChip, CommandBlock } from "@/components/landing/CopyBlock";
import { asset } from "@/lib/landing/asset";
import { DOT_PAPER_BG, GRAIN_240 } from "@/lib/landing/textures";
import {
  AUTH_NOTES,
  CLIENT_GUIDES,
  CLIENT_IDS,
  INTRO,
  MACHINE_MD,
  PROMPTS,
  SERVER_URL,
  type AuthNotePart,
  type ClientBlock,
  type ClientId,
  type RichSegment,
} from "./content";

const HAIRLINE = "rgba(58,74,38,0.14)";

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

type Mode = "human" | "machine";

function RichText({ segments }: { segments: RichSegment[] }) {
  return (
    <>
      {segments.map((segment, i) =>
        typeof segment === "string" ? (
          <span key={i}>{segment}</span>
        ) : (
          <code key={i} className="font-mono text-[13px]">
            {segment.code}
          </code>
        ),
      )}
    </>
  );
}

function ClientSetupBlocks({ blocks }: { blocks: ClientBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className={i === 0 ? "text-moss-700/80" : undefined}>
                {block.text}
              </p>
            );
          case "p-rich":
            return (
              <p key={i}>
                <RichText segments={block.segments} />
              </p>
            );
          case "cmd":
            return (
              <CommandBlock key={i}>
                {block.template.replaceAll("${SERVER_URL}", SERVER_URL)}
              </CommandBlock>
            );
          case "steps":
            return (
              <div key={i} className="flex flex-col gap-2">
                {block.intro && (
                  <p className="text-moss-700/80">{block.intro}</p>
                )}
                <ol className="flex flex-col">
                  {block.items.map((item, n) => (
                    <Step key={n} n={n + 1}>
                      {item}
                    </Step>
                  ))}
                </ol>
              </div>
            );
        }
      })}
    </div>
  );
}

function AuthNoteBody({ parts }: { parts: AuthNotePart[] }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : (
          <a
            key={i}
            href={part.href}
            data-cursor="hover"
            className="text-moss-700 underline underline-offset-2"
          >
            {part.text}
          </a>
        ),
      )}
    </>
  );
}

function ClientInstructions({ client }: { client: ClientId }) {
  return <ClientSetupBlocks blocks={CLIENT_GUIDES[client].blocks} />;
}

function ClientTabs() {
  const [client, setClient] = useState<ClientId>("claude");
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle title="Point your client at the server" />
      <PillTabGroup
        value={client}
        onValueChange={setClient}
        ariaLabel="MCP client"
        options={CLIENT_IDS.map((id) => ({
          value: id,
          label: CLIENT_GUIDES[id].label,
        }))}
      />
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
          {AUTH_NOTES.map((note) => (
            <Rise key={note.lead}>
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
                  <AuthNoteBody parts={note.parts} />
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
    <div className="relative">
      {/* Backdrop: aerial terraces behind the same frosted veil as the hero
          (blur values match HeroReveal's, painted on an oversized plate so
          the blur never samples past the edges). Fixed so the paper scrolls
          over it. */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        {/* Blur baked into the image — no live CSS filter mid-scroll. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset("/footer/footer-pastel-soft.jpg")}
          alt=""
          draggable={false}
          className="h-full w-full object-cover object-[68%_12%]"
        />
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
            backgroundImage: GRAIN_240,
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
            style={DOT_PAPER_BG}
          />

          <div className="relative flex flex-col gap-10 px-6 py-10 sm:px-12 sm:py-14 md:px-16">
            {/* Mode toggle — sits at the top of the paper and scrolls away
                with it */}
            <div className="-mb-4 flex justify-end">
              <PillTabGroup
                value={mode}
                onValueChange={setMode}
                ariaLabel="Reading mode"
                variant="segmented"
                options={[
                  { value: "human", label: "human" },
                  { value: "machine", label: "machine" },
                ]}
              />
            </div>

            {mode === "human" ? <HumanMode /> : <MachineMode />}
          </div>
        </div>
      </div>
    </div>
  );
}
