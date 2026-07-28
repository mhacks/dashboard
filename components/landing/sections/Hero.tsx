"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { HeroReveal } from "@/components/landing/HeroReveal";
import { MlhBadge } from "@/components/landing/MlhBadge";
import { Typewriter } from "@/components/landing/Typewriter";
import { DeadlineCountdown } from "@/components/landing/DeadlineCountdown";
import { AsciiGlow } from "@/components/landing/AsciiGlow";
import { CtaButton } from "@/components/landing/cta-button";
import { useMobileLayout } from "@/lib/landing/useMobileLayout";
import { asset } from "@/lib/landing/asset";
import { GRAIN_140 } from "@/lib/landing/textures";
import { scrollToHash } from "@/lib/landing/scroll";
import { prefersReducedMotion } from "@/lib/utils";

/* Hero backdrop variants, switched by the icon buttons above the countdown.
   `src: null` keeps HeroReveal's default multi-resolution meadow set. The
   blur + dot-grid + ASCII treatment is applied by HeroReveal/AsciiGlow in
   CSS, so it covers every variant automatically. */
const HERO_BGS = [
  {
    id: "leaf",
    icon: "/hero/icon-leaf.png",
    label: "Meadow backdrop",
    src: null,
    blurSrc: null,
  },
  {
    id: "flower",
    icon: "/hero/icon-flower.png",
    label: "Peony garden backdrop",
    src: "/hero/hero-flower.jpg",
    blurSrc: "/hero/hero-flower-1280.jpg",
  },
  {
    id: "cloud",
    icon: "/hero/icon-cloud.png",
    label: "Sky backdrop",
    src: "/hero/hero-cloud.jpg",
    blurSrc: "/hero/hero-cloud-1280.jpg",
  },
] as const;

type HeroBgId = (typeof HERO_BGS)[number]["id"];

export function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const reducedRef = useRef(false);
  const mobile = useMobileLayout();
  const [bgId, setBgId] = useState<HeroBgId>("leaf");

  useEffect(() => {
    reducedRef.current = prefersReducedMotion();
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
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    pointerX.set((e.clientX - r.left) / r.width);
    pointerY.set((e.clientY - r.top) / r.height);
  };
  const onTiltLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  // Lenis already smooths the scroll position — mapping progress directly
  // (no spring) keeps the parallax locked to the scroll instead of lagging it.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const titleY = useTransform(scrollYProgress, [0, 1], ["0vh", "26vh"]);
  const titleScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 0.9, 0]);

  const bgScale = useTransform(scrollYProgress, [0, 1], [1.02, 1.14]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "-6%"]);

  const activeBg = HERO_BGS.find((b) => b.id === bgId) ?? HERO_BGS[0];
  const bgProps = activeBg.src
    ? {
        src: asset(activeBg.src),
        blurSrc: activeBg.blurSrc ? asset(activeBg.blurSrc) : undefined,
      }
    : {};
  // The meta row tracks the title's drift so the lockup stays intact while fading.
  const metaOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);

  return (
    <section
      ref={ref}
      id="top"
      data-cursor-box="You"
      data-cursor-zone
      className="relative z-[4] w-full overflow-hidden"
      style={{ minHeight: "100vh" }}
      onMouseMove={onTiltMove}
      onMouseLeave={onTiltLeave}
    >
      {/* Light photo underneath, dark dotted overlay revealed by cursor.
          Wrapped in a perspective stage so it tilts toward the pointer;
          slightly overscaled to keep edges hidden while leaning. */}
      <div className="absolute inset-0 z-0" style={{ perspective: 1100 }}>
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{
            rotateX: tiltX,
            rotateY: tiltY,
            x: shiftX,
            y: shiftY,
            scale: 1.06,
          }}
        >
          <HeroReveal scale={bgScale} y={bgY} {...bgProps} />
        </motion.div>
      </div>

      {/* Breathing ASCII starfield, counter-drifting for parallax depth.
          data-stack-pause: StackedPages display-toggles this while the hero
          is buried under later sheets so the canvas loop stops. */}
      <motion.div
        data-stack-pause
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{ x: starX, y: starY }}
      >
        <AsciiGlow cell={mobile ? 14 : 22} density={mobile ? 0.55 : 0.34} />
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

      {/* Meta row + giant title, edge-aligned as one lockup */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center pt-16">
        {/* Width is set by the title, so the meta row spans exactly its edges. */}
        <div className="relative flex flex-col gap-4 md:gap-6">
          {/* Live application deadline countdown — absolutely positioned so it
              doesn't push the title off vertical center */}
          <motion.div
            style={{ opacity: metaOpacity, y: titleY }}
            className="absolute -top-[118px] left-0 right-0 flex justify-center md:-top-[126px]"
          >
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset(b.icon)}
                      alt=""
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
              y: titleY,
              scale: titleScale,
              opacity: titleOpacity,
              fontSize: "clamp(44px, 15vw, 250px)",
              lineHeight: 0.9,
              letterSpacing: "-0.025em",
              textShadow: "0 6px 40px rgba(20,30,10,0.35)",
            }}
            className="font-serif-it text-cream text-center whitespace-nowrap will-change-transform"
          >
            <Typewriter
              text="MHACKS 2026"
              delay={400}
              speed={85}
              className="block"
            />
          </motion.h1>

          <motion.div
            style={{ opacity: metaOpacity, y: titleY }}
            className="flex flex-col items-center gap-y-2 px-4 text-center lg:flex-row lg:flex-wrap lg:items-baseline lg:justify-between lg:gap-x-16 lg:px-1 lg:text-left"
          >
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
          <motion.div
            style={{ opacity: metaOpacity, y: titleY }}
            className="flex justify-center md:hidden"
          >
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

      {/* Scroll cue — chevron flashing between full and zero opacity.
          Outer layer fades with scroll, middle layer plays the entrance,
          inner layer oscillates — nesting keeps the three opacities from
          fighting over the same property. */}
      <motion.div
        style={{ opacity: metaOpacity }}
        className="absolute left-1/2 bottom-16 -translate-x-1/2 z-10"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.4 }}
        >
          <motion.svg
            aria-hidden
            width="30"
            height="17"
            viewBox="0 0 30 17"
            fill="none"
            className="text-cream drop-shadow-[0_1px_8px_rgba(20,30,10,0.55)]"
            animate={{ opacity: [1, 0, 1] }}
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
      </motion.div>
    </section>
  );
}
