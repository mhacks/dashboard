"use client";

import { motion } from "framer-motion";

/**
 * Sticker-style species tag for the botanical garlands. The site's flowers
 * are a Michigan-flora highlight, so each garland gets an identifying label
 * tucked into a dip in its vine (positioned by the parent): common name,
 * scientific name, and what kind of plant it is plus whether it's actually
 * native to Michigan.
 */
type Tone = "native" | "introduced" | "invasive";

const TONE_COLOR: Record<Tone, string> = {
  native: "text-moss-500",
  introduced: "text-[#8A6D2B]",
  invasive: "text-[#A2542C]",
};

export function SpeciesLabel({
  name,
  species,
  status,
  tone = "native",
  rotate = -3,
  className = "",
}: {
  name: string;
  /** Scientific (Latin) name, shown in italics under the common name. */
  species: string;
  /** Plant type + provenance, e.g. "native wildflower". */
  status: string;
  tone?: Tone;
  rotate?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.75, rotate }}
      whileInView={{ opacity: 1, scale: 1, rotate }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1], delay: 0.55 }}
      viewport={{ once: true, amount: 0.5 }}
      className={`flex-col items-center rounded-[10px] border border-[rgba(58,74,38,0.16)] bg-[#FFFBEF] px-4 py-2 text-center ${className}`}
      style={{ boxShadow: "0 0 0 3px rgba(255,251,239,0.55)" }}
    >
      <span className="font-serif-it text-[15px] leading-tight text-moss-700">
        {name}
      </span>
      <span className="mt-0.5 font-serif-it text-[11px] italic leading-tight text-moss-500">
        {species}
      </span>
      <span
        className={`mt-1 font-mono text-[9px] uppercase tracking-[0.2em] ${TONE_COLOR[tone]}`}
      >
        {status}
      </span>
    </motion.div>
  );
}
