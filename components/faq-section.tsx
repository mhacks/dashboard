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
    a: "We offer travel reimbursements on a limited basis for participants traveling from outside the Ann Arbor area. Apply during registration and we'll follow up with details.",
  },
  {
    q: "How much does MHacks cost?",
    a: "MHacks is completely free to attend. We cover meals, snacks, and event resources throughout the entire 24-hour event, thanks to our generous sponsors.",
  },
  {
    q: "How do teams work?",
    a: "Teams can have 1–4 members. You can form a team before the event or find teammates at our team formation session at the start of the hackathon.",
  },
  {
    q: "What are the tracks and prizes?",
    a: "We have four tracks: AI, Sustainability, Healthcare, and Fintech. Each track has dedicated prizes and mentors, plus an overall grand prize awarded to the best project across all tracks.",
  },
  {
    q: "What if this is my first hackathon?",
    a: "First-timers are absolutely welcome. We'll have intro workshops, beginner-friendly resources, and dedicated mentors to help you build something great regardless of your experience level.",
  },
];

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: index * 0.04, ease: EASE }}
      className="border-b"
      style={{ borderColor: "rgba(58,74,38,0.12)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-baseline gap-5 px-2 py-6 text-left transition-colors duration-300 md:px-4"
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "rgba(58,74,38,0.04)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <span
          className="font-mono text-[11px] tracking-[0.2em]"
          style={{ color: "rgba(58,74,38,0.4)" }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="flex-1 font-heading italic text-2xl leading-tight md:text-[26px]"
          style={{ color: "#3A4A26" }}
        >
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="font-mono text-xl"
          style={{ color: "rgba(58,74,38,0.5)" }}
        >
          +
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="overflow-hidden"
          >
            <p
              className="max-w-[600px] pb-7 pl-9 text-[15px] font-light leading-relaxed md:pl-12"
              style={{ color: "rgba(58,74,38,0.7)" }}
            >
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FaqSection() {
  return (
    <section id="faqs" className="scroll-mt-20 px-5 py-24 md:px-10">
      <div className="mx-auto max-w-3xl">
        <p
          className="text-center text-[11px] font-light uppercase tracking-[0.3em] flex items-center justify-center gap-2"
          style={{ color: "rgba(58,74,38,0.5)" }}
        >
          <span>◆</span>Attending MHacks<span>◆</span>
        </p>
        <h2
          className="mt-6 text-center font-sans font-semibold text-4xl tracking-tight md:text-6xl"
          style={{ color: "#3A4A26" }}
        >
          Questions,{" "}
          <span
            className="font-heading italic"
            style={{ color: "rgba(58,74,38,0.6)" }}
          >
            answered.
          </span>
        </h2>

        <div
          className="mt-14 border-t"
          style={{ borderColor: "rgba(58,74,38,0.12)" }}
        >
          {FAQS.map((faq, i) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
