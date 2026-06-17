"use client";

import { motion } from "framer-motion";

const EASE = [0.25, 0.1, 0.25, 1] as const;

export default function CtaSection() {
  return (
    <section className="px-5 py-24 md:px-10 md:py-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mx-auto max-w-3xl text-center"
      >
        <p
          className="text-[11px] font-light uppercase tracking-[0.3em] flex items-center justify-center gap-2"
          style={{ color: "rgba(58,74,38,0.5)" }}
        >
          <span>◆</span>October 3–4, 2026<span>◆</span>
        </p>
        <h2
          className="mt-6 font-sans font-semibold text-4xl leading-[1.08] tracking-tight md:text-6xl"
          style={{ color: "#3A4A26" }}
        >
          Come build something{" "}
          <span className="font-heading italic" style={{ color: "rgba(58,74,38,0.6)" }}>
            that grows.
          </span>
        </h2>
        <p
          className="mx-auto mt-6 max-w-xl text-base font-light leading-relaxed"
          style={{ color: "rgba(58,74,38,0.7)" }}
        >
          Applications open June 22. Grab your spot for 24 hours of building,
          mentorship, and one unforgettable weekend in Ann Arbor.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#"
            className="inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#3A4A26" }}
          >
            Apply Now
          </a>
          <a
            href="mailto:sponsors@mhacks.org"
            className="inline-flex items-center rounded-full border px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ borderColor: "rgba(58,74,38,0.3)", color: "#3A4A26" }}
          >
            Sponsor Us
          </a>
        </div>
      </motion.div>
    </section>
  );
}
