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
        <h2
          className="font-sans font-semibold text-4xl leading-[1.08] tracking-tight md:text-6xl"
          style={{ color: "#3A4A26" }}
        >
          Come{" "}
          <span
            className="rounded-md px-2"
            style={{ backgroundColor: "rgba(200,212,168,0.45)" }}
          >
            build
          </span>{" "}
          something that{" "}
          <span className="decoration-[#c8d4a8] decoration-4 underline-offset-8 underline">
            grows
          </span>
          .
        </h2>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/apply"
            className="font-red-hat inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#3A4A26" }}
          >
            Apply Now
          </a>
          <a
            href="mailto:sponsorship@mhacks.org"
            className="font-red-hat inline-flex items-center rounded-full border px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ borderColor: "rgba(58,74,38,0.3)", color: "#3A4A26" }}
          >
            Sponsor Us
          </a>
        </div>
      </motion.div>
    </section>
  );
}
