"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PolaroidDecor } from "@/components/landing/PolaroidDecor";
import { SplitReveal } from "@/components/landing/SplitReveal";
import { ImageCarousel } from "@/components/landing/ImageCarousel";
import { FlowerStamps } from "@/components/landing/FlowerStamps";
import { AsciiBloom } from "@/components/landing/AsciiBloom";

/* Keeps the blossom a single Image in the DOM rather than nesting it in a
   motion wrapper, so the existing layout classes still apply directly. */
const MotionImage = motion.create(Image);

export function About() {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start start"],
  });
  // Starts exactly equal to the -mt-28 pull-up (112px), so at page load the
  // sheet's top sits flush with the hero's bottom edge — the hero owns the
  // full first viewport and About only appears once you scroll. The -mt pulls
  // the section 112px into the viewport before any scrolling, so progress at
  // load is 112/viewportHeight, not 0 — anchor the ramp there.
  const [loadProgress, setLoadProgress] = useState(0);
  useEffect(() => {
    const update = () => setLoadProgress(112 / window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const tabY = useTransform(scrollYProgress, [loadProgress, 1], [112, 0]);

  return (
    <section ref={ref} id="about" className="relative z-[5] -mt-28 w-full pb-0">
      <motion.div
        style={{
          y: tabY,
          borderTopLeftRadius: 48,
          borderTopRightRadius: 48,
          // Dot-paper texture layered over the section's ambient gradients.
          backgroundImage:
            "radial-gradient(rgba(58,74,38,0.16) 1px, transparent 1.4px), radial-gradient(1200px 600px at 80% -10%, rgba(122,147,201,0.15), transparent 60%), linear-gradient(180deg, var(--parchment), #eee6c8)",
          backgroundSize: "26px 26px, auto, auto",
        }}
        className="relative flex min-h-screen w-full flex-col overflow-hidden px-6 md:px-[8vw] pt-20 pb-32 md:pt-24 md:pb-40"
      >
        <FlowerStamps tone="light" />

        <PolaroidDecor
          src="/about/about-09.jpg"
          caption="ann arbor, mi"
          side="right"
          initialRotate={9}
          restRotate={5}
          hoverRotate={-2.5}
          delay={0.25}
        />

        <PolaroidDecor
          src="/about/about-10.jpg"
          caption="university of michigan"
          side="left"
          initialRotate={-10}
          restRotate={-6}
          hoverRotate={3}
          delay={0.35}
          shadow="0 26px 60px rgba(29,36,18,0.28)"
        />

        {/* Centered heading + copy filling the viewport */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* Peach blossom resting above the heading */}
          <MotionImage
            src="/about/blossom.png"
            alt=""
            aria-hidden
            width={104}
            height={94}
            draggable={false}
            initial={{ opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            viewport={{ once: true, amount: 0.5 }}
            /* h-auto so the height attribute doesn't pin the box — the width
               classes drive the size and height follows the aspect ratio. */
            className="mb-4 h-auto w-[84px] select-none md:w-[104px]"
          />
          <h2
            className="font-display font-medium text-moss-700"
            style={{
              fontSize: "clamp(30px, 4vw, 48px)",
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
            }}
          >
            <span className="flex items-center justify-center gap-3">
              <SplitReveal as="span" className="block">
                {"About MHacks"}
              </SplitReveal>
              <span
                aria-hidden
                className="font-mono text-[0.42em] tracking-[0.08em] text-moss-500"
              >
                {".☘︎ ݁˖"}
              </span>
            </span>
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            viewport={{ once: true, amount: 0.5 }}
            className="mt-8 max-w-[620px] text-[15px] leading-[1.6] text-[#3d4730]"
          >
            MHacks is the University of Michigan&rsquo;s flagship hackathon. 24
            hours of creative engineering, design, building, and prototyping
            that blur the line between code and the real world. Join 1,000+
            student builders this fall in Ann Arbor and build something that can
            have lasting impact.
          </motion.p>

          {/* Hint for the click-to-stamp flowers */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.4 }}
            viewport={{ once: true, amount: 0.5 }}
            className="mt-12 flex items-center justify-center gap-3 text-moss-500"
          >
            <AsciiBloom className="font-mono text-[9px] leading-[1.15]" />
            <span className="relative font-mono text-[13px] tracking-[0.08em]">
              Click around the canvas for some fun.
              {/* Hand-drawn marker underline, drawn on when scrolled into
                  view — two wobbly passes so it reads like a real swipe */}
              <svg
                aria-hidden
                viewBox="0 0 330 14"
                fill="none"
                className="absolute left-0 top-full mt-0.5 w-full"
                style={{ overflow: "visible" }}
              >
                <motion.path
                  d="M5 8 C 52 3.5, 98 12, 150 7.5 C 196 3.8, 242 11, 284 7 C 302 5.4, 316 6.4, 326 5.5"
                  stroke="#5D6B3A"
                  strokeWidth="6"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.75 }}
                  viewport={{ once: true, amount: 0.9 }}
                  transition={{
                    duration: 0.85,
                    ease: [0.65, 0, 0.35, 1],
                    delay: 0.9,
                  }}
                />
                <motion.path
                  d="M10 11 C 70 7, 150 12.5, 214 9 C 258 6.6, 300 9.5, 324 8"
                  stroke="#5D6B3A"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.4 }}
                  viewport={{ once: true, amount: 0.9 }}
                  transition={{
                    duration: 0.8,
                    ease: [0.65, 0, 0.35, 1],
                    delay: 1.05,
                  }}
                />
              </svg>
            </span>
          </motion.div>
        </div>

        {/* Photo carousel — full bleed, drifting right to left */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          viewport={{ once: true, amount: 0.3 }}
          className="mt-14 md:mt-16 -mx-6 md:-mx-[8vw]"
        >
          <ImageCarousel className="px-6 md:px-[8vw]" />
        </motion.div>
      </motion.div>
    </section>
  );
}
