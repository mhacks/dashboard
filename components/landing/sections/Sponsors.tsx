"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SplitReveal } from "@/components/landing/SplitReveal";
import { CtaButton } from "@/components/landing/cta-button";
import { FlowerStamps } from "@/components/landing/FlowerStamps";
import { SpeciesLabel } from "@/components/landing/SpeciesLabel";
import { StackedSheet } from "@/components/landing/StackedSheet";
import { useGarlandEntrance } from "@/lib/landing/useGarlandEntrance";
import { useStackPaused } from "@/lib/landing/useStackPaused";
import Image from "next/image";

export function Sponsors() {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const paused = useStackPaused(ref);
  const branchX = useGarlandEntrance(ref, "left");

  return (
    <StackedSheet
      ref={ref}
      id="sponsors"
      className="z-[6] flex min-h-screen flex-col justify-center bg-moss-700 text-cream px-6 md:px-[8vw] py-24 md:py-32"
    >
      {/* Blueprint grid (Studio Apply-style) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(239,233,212,0.055) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(239,233,212,0.055) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "96px 96px",
        }}
      />

      <FlowerStamps tone="dark" />

      {/* Blossom branch filling the gap above the heading — full-bleed, in
          flow so it can never collide with the heading below it */}
      <motion.div
        aria-hidden
        style={{ x: reduced ? 0 : branchX }}
        className="pointer-events-none relative -mx-6 mb-12 md:-mx-[8vw] md:mb-14"
      >
        {/* Gentle idle sway on top of the scroll-linked drift, anchored
            toward the branch's right side like it's rooted offscreen */}
        <motion.div
          animate={
            reduced || paused
              ? undefined
              : { rotate: [-1.1, 1.5, -1.1], y: [-8, 9, -8] }
          }
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "85% 50%" }}
        >
          <Image
            src="/sponsors/branch.webp"
            alt=""
            width={2200}
            height={535}
            sizes="88vw"
            draggable={false}
            className="ml-auto h-auto w-[88%]"
          />
        </motion.div>
        {/* Species tag in the blank pocket above the branch's dip */}
        <SpeciesLabel
          name="Apple Blossom"
          species="Malus domestica"
          status="introduced · state flower"
          tone="introduced"
          rotate={0}
          className="absolute left-[calc(57%+20px)] top-[calc(6%-40px)] hidden md:flex"
        />
      </motion.div>

      <div className="relative mb-16 flex min-h-[120px] flex-wrap items-stretch justify-between gap-10">
        <h2
          className="self-start font-display font-medium text-cream"
          style={{
            fontSize: "clamp(30px, 4vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
          }}
        >
          <span className="flex items-center gap-3">
            <SplitReveal as="span" className="block">
              {"Our Sponsors"}
            </SplitReveal>
            <span
              aria-hidden
              className="font-mono text-[0.42em] tracking-[0.08em] text-cream/60"
            >
              {"ᯓ★ˎˊ˗"}
            </span>
          </span>
        </h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          viewport={{ once: true, amount: 0.5 }}
          className="max-w-[480px] self-end text-[17px] leading-[1.6] text-[#dcd8c2]"
        >
          Our 2026 sponsor lineup is taking shape, check back soon.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        viewport={{ once: true, amount: 0.4 }}
        className="relative flex flex-wrap items-center justify-between gap-6 rounded-lg border p-9"
        style={{
          borderColor: "rgba(239,233,212,0.25)",
          background:
            "linear-gradient(135deg, rgba(232,211,90,0.08), rgba(224,122,154,0.08))",
        }}
      >
        <div>
          <div
            className="font-serif-it text-cream"
            style={{ fontSize: 32, lineHeight: 1.1 }}
          >
            <span className="md:hidden">Sponsor MHacks.</span>
            <span className="hidden md:inline">Sponsor MHacks 2026.</span>
          </div>
          <div className="mt-2 text-[14px] text-[#bdc59a]">
            Reach 1,000+ technical students from across North America.
          </div>
        </div>
        <CtaButton href="mailto:sponsor@mhacks.org" variant="cream" size="md">
          <span className="md:hidden">Contact us</span>
          <span className="hidden md:inline">
            Interested in sponsoring? Contact us
          </span>
        </CtaButton>
      </motion.div>
    </StackedSheet>
  );
}
