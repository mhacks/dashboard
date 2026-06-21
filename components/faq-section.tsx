"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE = [0.25, 0.1, 0.25, 1] as const;

const FAQS = [
  {
    q: "What is MHacks?",
    a: "MHacks is the University of Michigan's premier student-run hackathon, held annually in Ann Arbor. It brings together hundreds of students from across the country for a weekend of building, learning, and competing.",
  },
  {
    q: "Who can attend?",
    a: "MHacks is open to all currently enrolled undergraduate and graduate students. Students of all skill levels and disciplines are welcome — no prior hackathon experience required.",
  },
  {
    q: "Where is MHacks?",
    a: "MHacks is held on the University of Michigan's campus in Ann Arbor, Michigan. Venue details will be shared with registered participants closer to the event date.",
  },
  {
    q: "Are there travel reimbursements?",
    a: "We offer travel reimbursements on a limited basis for participants traveling from outside the Ann Arbor area. To qualify, submit your application before the early deadline (Aug. 7) and we'll follow up with details.",
  },
  {
    q: "How much does MHacks cost?",
    a: "MHacks is completely free to attend. We cover meals, snacks, and event resources throughout the entire event, thanks to our generous sponsors.",
  },
];

function FaqItem({
  q,
  a,
  isLast,
}: {
  q: string;
  a: string;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={isLast ? "" : "border-b"}
      style={{ borderColor: "rgba(58,74,38,0.12)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-5 py-[18px] text-left md:py-5"
      >
        <span
          className="font-heading italic text-[18px] leading-tight md:text-[20px]"
          style={{ color: "#3A4A26" }}
        >
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          aria-hidden
          className="shrink-0 text-[15px]"
          style={{ color: "rgba(58,74,38,0.55)" }}
        >
          ›
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <p
              className="font-red-hat max-w-[620px] pb-6 text-[14px] font-light leading-relaxed"
              style={{ color: "rgba(58,74,38,0.7)" }}
            >
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FaqSection() {
  return (
    <section id="faqs" className="relative w-full overflow-hidden bg-[#d1f5ff]">
      {/* Hills band: cream paper → green hills → fades into the sky */}
      <img
        src="/hills.png"
        alt=""
        aria-hidden
        className="block w-full select-none"
      />

      {/* Sky region holding the FAQ card and the flower garden */}
      <div className="relative h-[clamp(820px,86vw,1240px)]">
        {/* Live FAQ card, floating on the sky */}
        <div className="absolute inset-x-0 top-[40px] flex justify-center px-5">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE }}
            className="w-[58%] min-w-[320px] max-w-[820px] rounded-[28px] bg-white px-7 py-10 shadow-[0_24px_60px_rgba(40,70,90,0.12)] md:px-14 md:py-12"
          >
            <h2
              className="text-center font-heading text-[clamp(2.25rem,4.5vw,3.25rem)] leading-none"
              style={{ color: "#2f3b1f" }}
            >
              FAQs
            </h2>
            <div className="mx-auto mt-7 max-w-[640px] md:mt-9">
              {FAQS.map((faq, i) => (
                <FaqItem
                  key={faq.q}
                  q={faq.q}
                  a={faq.a}
                  isLast={i === FAQS.length - 1}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Flower garden — overlaps in front of the card's lower edge */}
        <img
          src="/garden-flowers.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 z-20 w-full select-none"
        />
      </div>
    </section>
  );
}
