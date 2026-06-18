"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const EASE = [0.25, 0.1, 0.25, 1] as const;

/** Corner bracket fiducials */
function Fiducials() {
  const corner = "absolute w-4 h-4 border-[rgba(58,74,38,0.3)]";
  return (
    <>
      <span className={`${corner} top-3 left-3 border-t border-l`} />
      <span className={`${corner} top-3 right-3 border-t border-r`} />
      <span className={`${corner} bottom-3 left-3 border-b border-l`} />
      <span className={`${corner} bottom-3 right-3 border-b border-r`} />
    </>
  );
}

export default function SponsorsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <section id="sponsors" className="scroll-mt-20 px-5 py-24 md:px-10">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        {/* Left — text */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <p
            className="font-red-hat text-[11px] font-light uppercase tracking-[0.3em] flex items-center gap-2"
            style={{ color: "rgba(58,74,38,0.5)" }}
          >
            <span>◆</span>Powering MHacks<span>◆</span>
          </p>
          <h2
            className="mt-6 font-sans font-semibold text-4xl leading-[1.08] tracking-tight md:text-6xl"
            style={{ color: "#3A4A26" }}
          >
            Help us empower
            <br />
            <span
              className="font-heading italic"
              style={{ color: "rgba(58,74,38,0.6)" }}
            >
              potential.
            </span>
          </h2>
          <p
            className="font-red-hat mt-6 max-w-md text-base font-light leading-relaxed"
            style={{ color: "rgba(58,74,38,0.7)" }}
          >
            MHacks built its success on the support of generous sponsors across
            industries. Learn how you can put your brand in front of the next
            generation of talented builders.
          </p>
          <div className="mt-9">
            <a
              href="mailto:sponsorship@mhacks.org"
              className="font-red-hat inline-flex items-center rounded-full border px-6 py-2.5 text-sm font-medium transition-all hover:opacity-70"
              style={{
                borderColor: "rgba(58,74,38,0.3)",
                color: "#3A4A26",
                backgroundColor: "#f4f2e8",
              }}
            >
              Become a sponsor ↗
            </a>
          </div>
        </motion.div>

        {/* Right — card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
        >
          <div
            ref={ref}
            className="relative isolate z-10 flex h-[440px] flex-col items-center justify-center overflow-hidden rounded-3xl border text-center"
            style={{
              backgroundColor: "#f4f2e8",
              borderColor: "rgba(58,74,38,0.1)",
            }}
          >
            {}
            <motion.img
              src="/sponsors-ascii.png"
              alt=""
              style={{ y: parallaxY }}
              className="absolute inset-0 h-[120%] w-full object-cover opacity-50"
            />
            <Fiducials />

            <span
              className="absolute left-7 top-6 font-mono text-[10px] uppercase tracking-[0.25em]"
              style={{ color: "rgba(58,74,38,0.55)" }}
            >
              sponsors/2026.log
            </span>
            <span
              className="absolute right-7 top-6 font-mono text-[10px] uppercase tracking-[0.25em]"
              style={{ color: "rgba(58,74,38,0.55)" }}
            >
              status: pending
            </span>

            <div className="relative">
              <h3
                className="font-heading text-5xl md:text-6xl"
                style={{ color: "#3A4A26" }}
              >
                Our Sponsors
              </h3>
              <p
                className="font-red-hat mt-4 text-2xl italic md:text-3xl"
                style={{ color: "rgba(58,74,38,0.8)" }}
              >
                Coming Soon
                <span className="ml-1 inline-block animate-[blink_1.1s_steps(1)_infinite]">
                  ▮
                </span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
