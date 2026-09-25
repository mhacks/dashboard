"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SplitReveal } from "@/components/landing/SplitReveal";
import { CtaButton } from "@/components/landing/cta-button";
import { Fireflies } from "@/components/landing/Fireflies";
import { FlowerStamps } from "@/components/landing/FlowerStamps";
import { SpeciesLabel } from "@/components/landing/SpeciesLabel";
import { StackedSheet } from "@/components/landing/StackedSheet";
import { useGarlandEntrance } from "@/lib/landing/useGarlandEntrance";
import { useStackPaused } from "@/lib/landing/useStackPaused";
import Image from "next/image";

type Sponsor = {
  name: string;
  file: string;
  url: string;
  /** Intrinsic pixel size of the logo file — feeds next/image's aspect box. */
  width: number;
  height: number;
};

// Tiered by sponsorship level — each tier renders one size, top to bottom.
const TIERS: {
  sponsors: Sponsor[];
  height: string;
  gap: string;
  sizes: string;
}[] = [
  {
    height: "clamp(120px, 16vw, 220px)",
    gap: "gap-8",
    sizes: "(max-width: 768px) 60vw, 600px",
    sponsors: [
      {
        name: "Fetch.ai",
        url: "https://fetch.ai",
        file: "fetch-ai",
        width: 1044,
        height: 390,
      },
    ],
  },
  {
    height: "clamp(84px, 10vw, 140px)",
    gap: "gap-6 md:gap-10",
    sizes: "(max-width: 768px) 40vw, 400px",
    sponsors: [
      {
        name: "Notability",
        url: "https://notability.com",
        file: "notability",
        width: 1068,
        height: 364,
      },
      {
        name: "FreeWILi",
        url: "https://freewili.com",
        file: "freewili",
        width: 1128,
        height: 404,
      },
      {
        name: "University of Michigan",
        url: "https://umich.edu",
        file: "umich",
        width: 1056,
        height: 376,
      },
    ],
  },
  {
    height: "clamp(60px, 6.5vw, 92px)",
    gap: "gap-4 md:gap-6",
    sizes: "(max-width: 768px) 30vw, 280px",
    sponsors: [
      {
        name: "AWS",
        url: "https://aws.amazon.com",
        file: "aws",
        width: 1122,
        height: 756,
      },
      {
        name: "Capital One",
        url: "https://www.capitalone.com",
        file: "capital-one",
        width: 1162,
        height: 538,
      },
      {
        name: "Meta",
        url: "https://www.meta.com",
        file: "meta",
        width: 1200,
        height: 442,
      },
      {
        name: "D. E. Shaw & Co.",
        url: "https://www.deshaw.com",
        file: "de-shaw",
        width: 1048,
        height: 426,
      },
      {
        name: "SpaceX",
        url: "https://www.spacex.com",
        file: "spacex",
        width: 1072,
        height: 304,
      },
      {
        name: "Council",
        url: "https://council.health",
        file: "council",
        width: 1058,
        height: 408,
      },
      {
        name: "Neon",
        url: "https://neon.com",
        file: "neon",
        width: 1064,
        height: 440,
      },
      {
        name: "Photon",
        url: "https://photon.codes",
        file: "photon",
        width: 1112,
        height: 378,
      },
      {
        name: "Freesolo",
        url: "https://freesolo.co",
        file: "freesolo",
        width: 1112,
        height: 406,
      },
      {
        name: "Relay",
        url: "https://relayapp.im",
        file: "relay",
        width: 1064,
        height: 994,
      },
      {
        name: "TechSmith",
        url: "https://www.techsmith.com",
        file: "techsmith",
        width: 1088,
        height: 382,
      },
      {
        name: "SpacetimeDB",
        url: "https://spacetimedb.com",
        file: "spacetimedb",
        width: 1076,
        height: 372,
      },
      {
        name: "Stevens Capital Management",
        url: "https://www.scm-lp.com",
        file: "scm",
        width: 1100,
        height: 906,
      },
      {
        name: "Salesforce",
        url: "https://www.salesforce.com",
        file: "salesforce",
        width: 1150,
        height: 820,
      },
      {
        name: "ElevenLabs",
        url: "https://elevenlabs.io",
        file: "elevenlabs",
        width: 1100,
        height: 346,
      },
    ],
  },
];

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

      <Fireflies stackPause />

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

      <div className="relative mb-16 flex items-center justify-center gap-4 md:gap-8">
        {/* Small blossom sprigs flanking the title, mirrored on the right */}
        {(["left", "right"] as const).map((side) => (
          <motion.div
            key={side}
            aria-hidden
            initial={{ opacity: 0, scaleX: side === "right" ? -1 : 1 }}
            animate={{
              opacity: 1,
              scaleX: side === "right" ? -1 : 1,
              rotate:
                reduced || paused
                  ? 0
                  : side === "left"
                    ? [-2, 2, -2]
                    : [2, -2, 2],
            }}
            transition={{
              opacity: { duration: 1, delay: 0.3 },
              rotate: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
            }}
            className={`pointer-events-none w-[110px] shrink-0 select-none md:w-[220px] ${
              side === "right" ? "order-last" : ""
            }`}
          >
            <Image
              src="/sponsors/branch.webp"
              alt=""
              width={2200}
              height={535}
              sizes="220px"
              draggable={false}
              className="h-auto w-full"
            />
          </motion.div>
        ))}
        <h2
          className="font-display font-medium text-cream"
          style={{
            fontSize: "clamp(30px, 4vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
          }}
        >
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className="-scale-x-100 shrink-0 font-mono text-[0.42em] tracking-[0.08em] text-cream/60"
            >
              {"ᯓ★ˎˊ˗"}
            </span>
            <SplitReveal as="span" className="block text-center">
              {"Our Sponsors"}
            </SplitReveal>
            <span
              aria-hidden
              className="shrink-0 font-mono text-[0.42em] tracking-[0.08em] text-cream/60"
            >
              {"ᯓ★ˎˊ˗"}
            </span>
          </span>
        </h2>
      </div>

      {/* Sticker wall — one row per tier, largest at the top */}
      <div className="relative mb-16 flex flex-col items-center gap-8 md:gap-12">
        {TIERS.map((tier, t) => (
          <div
            key={t}
            className={`flex flex-wrap items-center justify-center ${tier.gap}`}
          >
            {tier.sponsors.map((sp, i) => (
              <motion.div
                key={sp.file}
                initial={{ opacity: 0, y: 16, rotate: i % 2 ? 1.5 : -1.5 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.05 * i,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
                viewport={{ once: true, amount: 0.4 }}
                whileHover={
                  reduced ? undefined : { scale: 1.04, rotate: i % 2 ? -1 : 1 }
                }
                style={{ height: tier.height }}
              >
                <a
                  href={sp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${sp.name} (opens in a new tab)`}
                  data-cursor="hover"
                  className="block h-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/70"
                >
                  <Image
                    src={`/sponsors/${sp.file}.png`}
                    alt={sp.name}
                    title={sp.name}
                    width={sp.width}
                    height={sp.height}
                    sizes={tier.sizes}
                    draggable={false}
                    className="h-full w-auto select-none drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                  />
                </a>
              </motion.div>
            ))}
          </div>
        ))}
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
        <CtaButton
          href="mailto:sponsorship@mhacks.org"
          variant="cream"
          size="md"
        >
          <span className="md:hidden">Contact us</span>
          <span className="hidden md:inline">
            Interested in sponsoring? Contact us
          </span>
        </CtaButton>
      </motion.div>
    </StackedSheet>
  );
}
