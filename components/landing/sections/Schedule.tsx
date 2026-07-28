"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SplitReveal } from "@/components/landing/SplitReveal";
import { DotGridReactive } from "@/components/landing/DotGridReactive";
import { FlowerStamps } from "@/components/landing/FlowerStamps";
import { SpeciesLabel } from "@/components/landing/SpeciesLabel";
import { DEADLINES } from "@/lib/landing/deadlines";
import { StackedSheet } from "@/components/landing/StackedSheet";
import { useGarlandEntrance } from "@/lib/landing/useGarlandEntrance";
import { asset } from "@/lib/landing/asset";

/**
 * "Timeline" — the application-season schedule, typeset like a festival
 * programme: hairline-ruled rows with a big date, a time column, and the
 * milestone. Rows come from lib/deadlines.ts (single source of truth shared
 * with the hero countdown); only hard deadlines show a time.
 */
const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("en-US", {
    ...options,
    timeZone: "America/Detroit",
  });

const ROWS = DEADLINES.map((d) => ({
  id: d.id,
  dow: fmt(d.date, { weekday: "short" }),
  month: fmt(d.date, { month: "long" }),
  day: fmt(d.date, { day: "numeric" }),
  time: d.id.endsWith("-due")
    ? `${fmt(d.date, { hour: "numeric", minute: "2-digit", hour12: true })} ET`
    : "",
  label: d.label,
}));

export function Schedule() {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const garlandX = useGarlandEntrance(ref, "left");

  return (
    <StackedSheet
      ref={ref}
      id="timeline"
      className="z-[7] flex min-h-screen flex-col justify-center bg-moss-900 text-cream px-6 md:px-[8vw] py-24 md:py-32"
    >
      {/* Vignette: darker toward the edges so the schedule rows glow */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 35%, rgba(239,233,212,0.05) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Dot lattice that swells and brightens around the cursor */}
      <DotGridReactive stackPause />

      <FlowerStamps tone="dark" />

      {/* White lily-of-the-valley garland along the top — full-bleed, in flow */}
      <motion.div
        aria-hidden
        style={{ x: reduced ? 0 : garlandX }}
        className="pointer-events-none relative -mx-6 mb-10 md:-mx-[8vw] md:mb-12"
      >
        {/* Idle waver anchored toward the right, where the stem roots offscreen */}
        <motion.div
          animate={
            reduced ? undefined : { rotate: [-0.9, 1.2, -0.9], y: [-7, 8, -7] }
          }
          transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "85% 50%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset("/social/garland-white.webp")}
            alt=""
            draggable={false}
            className="ml-auto w-[88%]"
          />
        </motion.div>
        {/* Species tag in the blank pocket above the vine's dip — the one
            non-native species in the set, so it's flagged as invasive */}
        <SpeciesLabel
          name="Lily of the Valley"
          species="Convallaria majalis"
          status="invasive groundcover"
          tone="invasive"
          rotate={0}
          className="absolute left-[60%] top-[calc(14%-30px)] hidden md:flex"
        />
      </motion.div>

      <div className="relative mb-6 flex flex-wrap items-end justify-between gap-8 md:mb-8">
        <h2
          className="font-display font-medium text-cream"
          style={{
            fontSize: "clamp(30px, 4vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
          }}
        >
          <SplitReveal as="span" className="block">
            {"Timeline"}
          </SplitReveal>
        </h2>
        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.15 }}
          viewport={{ once: true, amount: 0.5 }}
          className="text-right font-mono text-[13px] leading-[2] tracking-[0.1em] text-cream/70 md:text-[18px] md:tracking-[0.14em]"
        >
          {"⋆˚꩜｡.ᐟ"}
          <br />
          {"˖᯽ ݁˖· ─ °❀⋆"}
        </motion.div>
      </div>

      <ol className="relative">
        {ROWS.map((row, i) => (
          <motion.li
            key={row.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              ease: [0.2, 0.8, 0.2, 1],
              delay: 0.1 + i * 0.09,
            }}
            viewport={{ once: true, amount: 0.4 }}
            className="flex items-center justify-between gap-4 border-t border-cream/15 py-5 md:gap-6 md:py-8"
          >
            {/* Weekday tag beside the full date, both on one baseline */}
            <div className="flex items-baseline gap-2 md:gap-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-cream/60 md:text-[11px] md:tracking-[0.16em]">
                {row.dow}
              </span>
              <span
                className="whitespace-nowrap font-display font-medium text-cream"
                style={{ fontSize: "clamp(21px, 3.6vw, 52px)", lineHeight: 1 }}
              >
                {row.month} {row.day}
              </span>
            </div>

            {/* Milestone pinned to the row's right edge, time tucked under */}
            <div className="min-w-0 text-right">
              <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-cream md:text-[16px] md:tracking-[0.08em]">
                {row.label}
              </div>
              {row.time && (
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/65 md:text-[13px] md:tracking-[0.16em]">
                  {row.time}
                </div>
              )}
            </div>
          </motion.li>
        ))}
      </ol>
    </StackedSheet>
  );
}
