"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Image from "next/image";

const EASE = [0.25, 0.1, 0.25, 1] as const;

const tracks = [
  {
    name: "Artificial Intelligence",
    description: "Build systems that sense, reason, and act in the world",
    flower: "/dark_blue_flower.png",
    glow: "rgba(99, 140, 220, 0.45)",
  },
  {
    name: "Sustainability",
    description: "Engineer tech-driven solutions for a resilient planet",
    flower: "/light_blue_flower.png",
    glow: "rgba(90, 170, 110, 0.45)",
  },
  {
    name: "Healthcare",
    description: "Reimagine how people access and receive care",
    flower: "/pink_flower.png",
    glow: "rgba(210, 100, 150, 0.45)",
  },
  {
    name: "Fintech",
    description: "Reshape money, markets, and economic access for all",
    flower: "/yellow_flower.png",
    glow: "rgba(210, 180, 60, 0.45)",
  },
];

const N = tracks.length;

function TrackCard({ track }: { track: (typeof tracks)[number] }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-3xl border"
      style={{ borderColor: "rgba(58,74,38,0.1)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, ${track.glow} 0%, #eef0e4 68%, #f4f2e8 100%)`,
        }}
      />
      <Image
        src={track.flower}
        alt=""
        width={176}
        height={176}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-90 object-contain"
      />
      <span
        className="absolute bottom-6 left-7 font-mono text-[11px] uppercase tracking-[0.22em]"
        style={{ color: "rgba(58,74,38,0.65)" }}
      >
        {track.name}
      </span>
    </div>
  );
}

function TrackRow({
  track,
  on,
}: {
  track: (typeof tracks)[number];
  on: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-5 rounded-2xl border px-6 py-5 transition-all duration-500 ${
        on
          ? "shadow-[0_14px_36px_-22px_rgba(58,74,38,0.55)]"
          : "border-transparent bg-transparent opacity-45"
      }`}
      style={
        on
          ? { borderColor: "rgba(58,74,38,0.25)", backgroundColor: "white" }
          : {}
      }
    >
      <div
        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: "rgba(58,74,38,0.1)",
          backgroundColor: "#f9f6ef",
        }}
      >
        <div
          className="absolute inset-1 rounded-full blur-md transition-opacity duration-500"
          style={{ background: track.glow, opacity: on ? 0.7 : 0 }}
        />
        <Image
          src={track.flower}
          alt=""
          width={32}
          height={32}
          className="relative object-contain"
        />
      </div>
      <div className="pt-0.5">
        <h3
          className={`font-sans text-[19px] font-semibold transition-colors duration-500`}
          style={{ color: on ? "#3A4A26" : "rgba(58,74,38,0.7)" }}
        >
          {track.name}
        </h3>
        <p
          className="mt-1 max-w-md text-sm font-light leading-relaxed"
          style={{ color: "rgba(58,74,38,0.65)" }}
        >
          {track.description}
        </p>
      </div>
    </div>
  );
}

export default function TracksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(N - 1, Math.max(0, Math.floor(v * N))));
  });

  return (
    <section
      id="tracks"
      ref={ref}
      className="scroll-mt-20 relative lg:h-[420vh]"
      style={{ backgroundColor: "rgba(249, 246, 239, 0.55)" }}
    >
      {/* Desktop — sticky scroll */}
      <div className="sticky top-0 hidden h-screen items-center overflow-hidden px-10 lg:flex">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-20">
          <div>
            <p
              className="text-[11px] font-light uppercase tracking-[0.3em] flex items-center gap-2"
              style={{ color: "rgba(58,74,38,0.5)" }}
            >
              <span>◆</span>Choose Your Focus<span>◆</span>
            </p>
            <h2
              className="mt-6 font-sans font-semibold text-5xl leading-[1.05] tracking-tight"
              style={{ color: "#3A4A26" }}
            >
              Official Tracks
            </h2>
            <div className="mt-10 flex flex-col gap-2.5">
              {tracks.map((track, i) => (
                <TrackRow key={track.name} track={track} on={i === active} />
              ))}
            </div>
          </div>

          {/* Stacked cards — active slides out upward */}
          <div className="relative h-[560px]">
            {tracks.map((track, i) => (
              <motion.div
                key={track.name}
                className="absolute inset-0"
                style={{ zIndex: N - i }}
                animate={
                  i < active
                    ? { opacity: 0, y: "-55%" }
                    : { opacity: 1, y: "0%" }
                }
                transition={{ duration: 0.7, ease: EASE }}
              >
                <TrackCard track={track} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile — simple stacked layout */}
      <div className="px-6 py-20 lg:hidden">
        <p
          className="text-[11px] font-light uppercase tracking-[0.3em] flex items-center gap-2"
          style={{ color: "rgba(58,74,38,0.5)" }}
        >
          <span>◆</span>Choose Your Focus<span>◆</span>
        </p>
        <h2
          className="mt-4 font-sans font-semibold text-4xl leading-[1.08] tracking-tight"
          style={{ color: "#3A4A26" }}
        >
          Official Tracks
        </h2>
        <div className="mt-8 flex flex-col gap-8">
          {tracks.map((track) => (
            <div key={track.name}>
              <TrackRow track={track} on />
              <div className="mt-4 h-64">
                <TrackCard track={track} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
