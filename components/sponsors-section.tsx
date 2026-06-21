"use client";

import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const SPONSORS =
  "Google, Meta, Uber, Apple, Amazon, Walmart, Target, Ford, GE, GM, Bloomberg, BlackRock, Optiver, Palantir, D.E. Shaw, Delta, EA";

export default function SponsorsSection() {
  return (
    <section
      id="sponsors"
      className="relative overflow-hidden bg-[#f4f2e8] px-5 pb-6 pt-24 md:px-10 md:pt-28"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative mx-auto flex max-w-[760px] flex-col items-center text-center"
      >
        <h2
          className="text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.1] tracking-[-0.03em]"
          style={{ color: "#3A4A26" }}
        >
          <span className="font-red-hat font-semibold">Our</span>{" "}
          <span className="font-heading italic">Sponsors</span>
        </h2>

        <p
          className="font-red-hat mt-5 text-[15px] font-medium leading-[1.5] md:text-[16px]"
          style={{ color: "rgba(0,0,0,0.5)" }}
        >
          The official 2026 lineup is on its way…
          <br />
          In the meantime, here&apos;s a list of our previous sponsors:
        </p>

        <p
          className="font-red-hat mx-auto mt-8 max-w-[620px] text-[15px] font-bold leading-[1.7] md:text-[17px]"
          style={{ color: "#262626" }}
        >
          {SPONSORS}
        </p>

        <p
          className="font-red-hat mt-5 text-[15px] font-medium md:text-[16px]"
          style={{ color: "rgba(0,0,0,0.5)" }}
        >
          …and more!
        </p>

        <a
          href="mailto:sponsorship@mhacks.org"
          className="font-red-hat mt-9 inline-flex items-center rounded-full bg-[#ffbce1] px-10 py-2.5 text-[18px] italic tracking-[-0.04em] text-[#2a2a2a] shadow-[0_4px_2px_rgba(0,0,0,0.15)] transition-transform duration-300 hover:-translate-y-0.5 md:text-[20px]"
        >
          Sponsor Us
        </a>
      </motion.div>
    </section>
  );
}
