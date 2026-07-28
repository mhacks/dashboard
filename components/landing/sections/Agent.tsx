"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SplitReveal } from "@/components/landing/SplitReveal";
import { FlowerStamps } from "@/components/landing/FlowerStamps";
import { SpeciesLabel } from "@/components/landing/SpeciesLabel";
import { AgentTerminal } from "@/components/landing/AgentTerminal";
import { CommandBlock } from "@/components/landing/CopyBlock";
import { CtaButton } from "@/components/landing/cta-button";
import { SERVER_URL } from "@/app/(marketing)/how-to-mcp/content";
import { StackedSheet } from "@/components/landing/StackedSheet";
import { useGarlandEntrance } from "@/lib/landing/useGarlandEntrance";
import { asset } from "@/lib/landing/asset";

/**
 * "Agent" — teaser sheet for the MCP guide: MHacks has an MCP server, so
 * hackers can apply through Claude/Codex instead of the web form. Sits
 * between the Timeline and FAQ sheets; the CTA leads to /how-to-mcp.
 */
export function Agent() {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const garlandX = useGarlandEntrance(ref, "right");

  return (
    <StackedSheet
      ref={ref}
      id="agent"
      className="z-[8] flex min-h-screen flex-col justify-center bg-parchment px-6 py-24 md:px-[8vw] md:py-32"
    >
      <FlowerStamps tone="light" />

      {/* Black-eyed Susan garland along the top — full-bleed, in flow */}
      <motion.div
        aria-hidden
        style={{ x: reduced ? 0 : garlandX }}
        className="pointer-events-none relative -mx-6 mb-8 md:-mx-[8vw] md:mb-12"
      >
        {/* Idle waver anchored toward the left, where the stem roots offscreen */}
        <motion.div
          animate={
            reduced ? undefined : { rotate: [-0.9, 1.1, -0.9], y: [-6, 7, -6] }
          }
          transition={{ duration: 6.1, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "12% 50%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset("/agent/garland-susan.webp")}
            alt=""
            draggable={false}
            className="w-[82%]"
          />
        </motion.div>
        <SpeciesLabel
          name="Black-Eyed Susan"
          species="Rudbeckia hirta"
          status="native wildflower"
          rotate={0}
          className="absolute left-[calc(36%+540px)] top-[calc(16%-8px)] hidden min-w-[215px] md:flex"
        />
      </motion.div>

      <div className="grid items-center gap-14 md:grid-cols-2">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <h2
              className="font-display font-medium text-moss-700"
              style={{
                fontSize: "clamp(30px, 4vw, 48px)",
                lineHeight: 1.15,
                letterSpacing: "-0.015em",
              }}
            >
              <SplitReveal as="span" className="block">
                Apply with your agent
              </SplitReveal>
            </h2>
            <p className="max-w-[460px] text-[16px] leading-[1.65] text-[#4d5942]">
              MHacks has an MCP server. Connect Claude, Codex, or any
              MCP-capable agent and apply without ever opening the form. Your
              agent reads the application schema, drafts your answers with you,
              and submits, all tied to your real MHacks login.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-moss-700/50">
              Server URL
            </p>
            <div className="max-w-[460px]">
              <CommandBlock>{SERVER_URL}</CommandBlock>
            </div>
          </div>

          <div>
            <CtaButton href={asset("/how-to-mcp")} variant="cta" size="md">
              How to connect →
            </CtaButton>
          </div>
        </div>

        <AgentTerminal className="w-full max-w-[560px] justify-self-center md:justify-self-end" />
      </div>
    </StackedSheet>
  );
}
