"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { HeroReveal } from "@/components/landing/HeroReveal";
import { MlhBadge } from "@/components/landing/MlhBadge";
import { Typewriter } from "@/components/landing/Typewriter";
import { DeadlineCountdown } from "@/components/landing/DeadlineCountdown";
import { AsciiGlow } from "@/components/landing/AsciiGlow";
import { CtaButton } from "@/components/landing/cta-button";
import { useMobileLayout } from "@/lib/landing/useMobileLayout";
import { GRAIN_140 } from "@/lib/landing/textures";
import { scrollToHash } from "@/lib/landing/scroll";
import { useStackPaused } from "@/lib/landing/useStackPaused";
import { prefersReducedMotion } from "@/lib/utils";

/* Hero backdrop variants, switched by the icon buttons above the countdown.
   `src: null` keeps HeroReveal's default meadow. The blur + dot-grid + ASCII
   treatment is applied by HeroReveal/AsciiGlow in CSS, so it covers every
   variant automatically. Paths are raw: next/image builds its own
   /_next/image URLs, which Next's basePath already rewrites. */
const HERO_BGS = [
  {
    id: "leaf",
    icon: "/hero/icon-leaf.png",
    label: "Meadow backdrop",
    src: null,
  },
  {
    id: "flower",
    icon: "/hero/icon-flower.png",
    label: "Peony garden backdrop",
    src: "/hero/hero-flower.jpg",
  },
  {
    id: "cloud",
    icon: "/hero/icon-cloud.png",
    label: "Sky backdrop",
    src: "/hero/hero-cloud.jpg",
  },
] as const;

type HeroBgId = (typeof HERO_BGS)[number]["id"];

export function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const paused = useStackPaused(ref);
  const reducedRef = useRef(false);
  const rectRef = useRef<DOMRect | null>(null);
  const mobile = useMobileLayout();
  const [bgId, setBgId] = useState<HeroBgId>("leaf");
  const [cursorBoxReady, setCursorBoxReady] = useState(false);

  useEffect(() => {
    reducedRef.current = prefersReducedMotion();
  }, []);

  // The section itself is never transformed (the tilt lives on an inner
  // layer), so its box only moves on scroll or resize. Caching it keeps the
  // pointer handler from forcing a synchronous layout on every mousemove —
  // scroll fires at most once per frame, so this reads at most once per frame.
  useEffect(() => {
    const invalidate = () => {
      rectRef.current = null;
    };
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);
    return () => {
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
    };
  }, []);

  // Cursor-driven 3D tilt: the meadow leans toward the pointer while the
  // ASCII starfield drifts the opposite way, so the layers read as depth.
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const px = useSpring(pointerX, { stiffness: 55, damping: 18, mass: 0.6 });
  const py = useSpring(pointerY, { stiffness: 55, damping: 18, mass: 0.6 });

  const tiltX = useTransform(py, [0, 1], [2.4, -2.4]);
  const tiltY = useTransform(px, [0, 1], [-3.2, 3.2]);
  const shiftX = useTransform(px, [0, 1], [-16, 16]);
  const shiftY = useTransform(py, [0, 1], [-11, 11]);
  const starX = useTransform(px, [0, 1], [9, -9]);
  const starY = useTransform(py, [0, 1], [7, -7]);

  const onTiltMove = (e: React.MouseEvent) => {
    if (reducedRef.current) return;
    let r = rectRef.current;
    if (!r) {
      r = ref.current?.getBoundingClientRect() ?? null;
      rectRef.current = r;
    }
    if (!r) return;
    pointerX.set((e.clientX - r.left) / r.width);
    pointerY.set((e.clientY - r.top) / r.height);
  };
  const onTiltLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  const activeBg = HERO_BGS.find((b) => b.id === bgId) ?? HERO_BGS[0];
  const bgProps = activeBg.src ? { src: activeBg.src } : {};

  return (
    <section
      ref={ref}
      id="top"
      data-cursor-box="You"
      data-cursor-box-ready={cursorBoxReady ? "" : undefined}
      data-cursor-zone
      className="relative z-[4] w-full min-h-[max(100dvh,640px)]"
      onMouseMove={onTiltMove}
      onMouseLeave={onTiltLeave}
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* StackedPages pins the hero while the next sheet rises — no scroll
          parallax here or the old page drifts instead of staying put. */}
        <div className="absolute inset-0 z-0" style={{ perspective: 1100 }}>
          <HeroReveal
            tiltX={tiltX}
            tiltY={tiltY}
            shiftX={shiftX}
            shiftY={shiftY}
            tiltScale={1.06}
            paused={paused}
            {...bgProps}
          />
        </div>

        {/* Breathing ASCII starfield — mounts only while the hero sheet is visible. */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{ x: starX, y: starY }}
        >
          {!paused && (
            <AsciiGlow cell={mobile ? 14 : 26} density={mobile ? 0.55 : 0.28} />
          )}
        </motion.div>

        {/* MLH trust badge, resting on the hero's top edge — scrolls away with
          the hero (covered by the next sheet), unlike the fixed header */}
        <MlhBadge />

        {/* Vignette for text legibility */}
        <div
          aria-hidden
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, rgba(29,36,18,0.2) 0%, rgba(29,36,18,0) 55%)",
          }}
        />

        {/* Top gradient band behind the headline/CTA/badge — fades out by 40%
          so the lower meadow stays untouched */}
        <div
          aria-hidden
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.15), transparent 40%)",
          }}
        />

        {/* Film grain — static, unblended, outside the transformed layers */}
        <div
          aria-hidden
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            backgroundImage: GRAIN_140,
            backgroundSize: "140px 140px",
            opacity: 0.38,
          }}
        />
      </div>

      {/* Meta row + giant title, edge-aligned as one lockup */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center pt-16">
        {/* Width is set by the title, so the meta row spans exactly its edges. */}
        <div className="relative flex flex-col gap-4 md:gap-6">
          {/* Live application deadline countdown — absolutely positioned so it
              doesn't push the title off vertical center */}
          <motion.div className="absolute -top-[118px] left-0 right-0 flex justify-center md:-top-[126px]">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.2, 0.8, 0.2, 1],
                delay: 0.2,
              }}
              className="pointer-events-auto flex flex-col items-center gap-3"
            >
              {/* Backdrop switcher — one icon per hero variant */}
              <div className="flex items-center justify-center gap-3">
                {HERO_BGS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-label={b.label}
                    aria-pressed={bgId === b.id}
                    data-cursor="hover"
                    onClick={() => setBgId(b.id)}
                    className={`grid h-12 w-12 place-items-center transition-all duration-300 ${
                      bgId === b.id
                        ? "scale-110 opacity-100 drop-shadow-[0_2px_10px_rgba(20,30,10,0.5)]"
                        : "opacity-60 hover:scale-105 hover:opacity-95"
                    }`}
                  >
                    <Image
                      src={b.icon}
                      alt=""
                      width={40}
                      height={40}
                      quality={40}
                      draggable={false}
                      className="h-10 w-10 object-contain"
                    />
                  </button>
                ))}
              </div>
              <DeadlineCountdown />
            </motion.div>
          </motion.div>

          <motion.h1
            style={{
              fontSize: "clamp(44px, 15vw, 250px)",
              lineHeight: 0.9,
              letterSpacing: "-0.025em",
              textShadow: "0 6px 40px rgba(20,30,10,0.35)",
            }}
            className="font-serif-it text-cream text-center whitespace-nowrap"
          >
            <Typewriter
              text="MHACKS 2026"
              delay={400}
              speed={85}
              className="block"
              onComplete={() => {
                ref.current?.setAttribute("data-cursor-box-ready", "");
                setCursorBoxReady(true);
                window.dispatchEvent(
                  new CustomEvent("mhacks:hero-cursor-ready"),
                );
              }}
            />
          </motion.h1>

          <motion.div className="flex flex-col items-center gap-y-2 px-4 text-center lg:flex-row lg:flex-wrap lg:items-baseline lg:justify-between lg:gap-x-16 lg:px-1 lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.2, 0.8, 0.2, 1],
                delay: 0.15,
              }}
            >
              <span className="text-cream text-[11px] md:text-[13px] lg:text-[15px] font-medium uppercase tracking-[0.18em] lg:tracking-[0.3em] [text-shadow:0_1px_12px_rgba(20,30,10,0.55)]">
                Build something that grows.
              </span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.2, 0.8, 0.2, 1],
                delay: 0.3,
              }}
            >
              <span className="block text-cream text-center lg:text-right text-[11px] md:text-[13px] lg:text-[15px] font-medium uppercase tracking-[0.18em] lg:tracking-[0.3em] [text-shadow:0_1px_12px_rgba(20,30,10,0.55)]">
                October 3–4, 2026 · Ann Arbor, Michigan
              </span>
            </motion.div>
          </motion.div>

          {/* Mobile CTAs — the header's Apply/Sponsor us pills live here on
              small screens, stacked under the date line */}
          <motion.div className="flex justify-center md:hidden">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.2, 0.8, 0.2, 1],
                delay: 0.4,
              }}
              className="pointer-events-auto mt-2 flex flex-col items-center gap-3"
            >
              <CtaButton
                href="/apply"
                variant="cta"
                size="md"
                className="w-[200px]"
              >
                Apply
              </CtaButton>
              <CtaButton
                href="/#sponsors"
                variant="parchment"
                size="md"
                className="w-[200px]"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToHash("#sponsors");
                }}
              >
                Sponsor us
              </CtaButton>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll cue — chevron flashing between full and zero opacity. */}
      <div className="absolute left-1/2 bottom-16 z-10 -translate-x-1/2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.4 }}
        >
          <motion.svg
            aria-hidden
            data-stack-pause
            width="30"
            height="17"
            viewBox="0 0 30 17"
            fill="none"
            className="text-cream drop-shadow-[0_1px_8px_rgba(20,30,10,0.55)]"
            animate={paused ? false : { opacity: [1, 0, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <path
              d="M2.5 2.5L15 14.5L27.5 2.5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </motion.div>
      </div>
    </section>
  );
}
