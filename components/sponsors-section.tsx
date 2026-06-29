"use client";

import { useRef } from "react";
import Image from "next/image";
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
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <section
      id="sponsors"
      className="scroll-mt-20 px-8 py-24 sm:px-12 md:px-16 lg:px-24"
    >
      <div className="relative mx-auto flex max-w-5xl items-start justify-center gap-3 md:gap-6">
        <Image
          src="/ascii_flower_2.png"
          alt=""
          width={496}
          height={824}
          className="pointer-events-none hidden h-auto w-[min(18vw,140px)] max-w-none shrink-0 select-none sm:block md:w-[min(16vw,180px)] lg:w-[200px]"
        />
        <div className="flex w-full max-w-md flex-col items-center md:max-w-lg">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, ease: EASE }}
            className="relative isolate z-10 flex min-h-[280px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border px-6 py-10 text-center md:min-h-[320px] md:px-8"
            style={{
              backgroundColor: "#f4f2e8",
              borderColor: "rgba(58,74,38,0.1)",
            }}
          >
            <motion.img
              src="/sponsors-ascii.png"
              alt=""
              style={{ y: parallaxY }}
              className="pointer-events-none absolute inset-x-0 -inset-y-[12%] h-[124%] w-full object-cover opacity-50"
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

            <div className="relative flex flex-col items-center gap-5">
              <div>
                <h3
                  className="font-heading text-3xl md:text-4xl"
                  style={{ color: "#3A4A26" }}
                >
                  Our Sponsors
                </h3>
                <p
                  className="font-red-hat mt-3 text-lg italic md:text-xl"
                  style={{ color: "rgba(58,74,38,0.8)" }}
                >
                  Coming Soon
                  <span className="ml-1 inline-block animate-[blink_1.1s_steps(1)_infinite]">
                    ▮
                  </span>
                </p>
              </div>
              <a
                href="mailto:sponsorship@mhacks.org"
                className="font-red-hat inline-flex items-center rounded-full border px-6 py-2.5 text-sm font-medium transition-all hover:opacity-70"
                style={{
                  borderColor: "rgba(58,74,38,0.3)",
                  color: "#3A4A26",
                  backgroundColor: "rgba(244,242,232,0.7)",
                }}
              >
                Become a sponsor ↗
              </a>
            </div>
          </motion.div>

          <Image
            src="/sponsors_bot.png"
            alt=""
            width={1024}
            height={66}
            unoptimized
            className="pointer-events-none mt-8 h-auto w-full max-w-xl origin-top scale-105 select-none object-contain object-center md:mt-10 md:max-w-2xl md:scale-110"
          />
        </div>
        <Image
          src="/ascii_flower_1.png"
          alt=""
          width={496}
          height={824}
          className="pointer-events-none hidden h-auto w-[min(18vw,140px)] max-w-none shrink-0 select-none sm:block md:w-[min(16vw,180px)] lg:w-[200px]"
        />
      </div>
    </section>
  );
}
