"use client";

import { motion, useReducedMotion } from "framer-motion";

import type { DecisionRound } from "@/lib/decisions";

const ROUND_LABEL: Record<DecisionRound, string> = {
  early: "Early · 2026",
  regular: "Regular · 2026",
};

/**
 * Decorative "accepted" seal, sitting alongside the welcome copy. Purely
 * presentational — the letter states the outcome in text, so this is
 * aria-hidden.
 *
 * Tilted like a stamped seal, matching the boarding-pass teaser treatment in
 * the source design.
 */
export function MHacksBadge({ round }: { round: DecisionRound }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      initial={reduceMotion ? false : { opacity: 0, scale: 0.75, rotate: -14 }}
      animate={{ opacity: 1, scale: 1, rotate: -4 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 240, damping: 15, delay: 0.15 }
      }
      className="shrink-0 select-none max-sm:mx-auto"
    >
      <div className="rounded-full border border-dashed border-olive/35 p-1.5">
        <div className="flex size-[118px] flex-col items-center justify-center gap-[3px] rounded-full border border-ink/15 bg-haze shadow-[0_10px_24px_-14px_rgba(16,24,10,0.5)]">
          <span className="font-red-hat text-[9px] leading-none text-olive/50">
            ✦
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/decision/mhacks-m.svg"
            alt=""
            width={24}
            height={24}
            className="block size-6 object-contain"
          />
          <span className="font-red-hat text-[13px] leading-none font-bold tracking-[0.16em] text-moss uppercase">
            Accepted
          </span>
          <span className="font-red-hat text-[8.5px] leading-none font-semibold tracking-[0.14em] text-ink/55 uppercase">
            {ROUND_LABEL[round]}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
