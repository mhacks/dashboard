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
    a: "We offer travel reimbursements on a limited basis for participants traveling from outside the Ann Arbor area. To qualify, you must submit your application before the early deadline (Aug. 7). Apply during registration and we'll follow up with details.",
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
    q: "What if this is my first hackathon?",
    a: "First-timers are absolutely welcome. We'll have intro workshops, beginner-friendly resources, and dedicated mentors to help you build something great regardless of your experience level.",
  },
];

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="border-b"
      style={{ borderColor: "rgba(31,42,22,0.12)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 py-6 text-left transition-colors duration-200"
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "rgba(31,42,22,0.03)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <span
          className="w-[36px] shrink-0 text-[11px] tracking-[2.2px]"
          style={{
            fontFamily: "Instrument Sans, sans-serif",
            fontWeight: 400,
            color: "rgba(31,42,22,0.4)",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="flex-1 text-[26px] not-italic"
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
            fontWeight: 400,
            lineHeight: "32.5px",
            color: "#3a4a26",
          }}
        >
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="shrink-0 text-[20px] leading-[28px]"
          style={{
            fontFamily: "Instrument Sans, sans-serif",
            fontWeight: 400,
            color: "rgba(31,42,22,0.5)",
          }}
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
              className="pb-6 text-base leading-relaxed font-light"
              style={{
                paddingLeft: "52px",
                color: "rgba(31,42,22,0.7)",
                fontFamily: "var(--font-red-hat-display), sans-serif",
              }}
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
    <section
      id="faqs"
      className="relative scroll-mt-20 overflow-hidden px-6 py-20 sm:px-10 md:py-28 lg:px-16"
    >
      {/* Background illustration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/water_faq.png"
          alt=""
          className="absolute inset-0 h-full w-full select-none object-cover object-top"
          aria-hidden
        />
      </div>

      {/* Card */}
      <div className="relative mx-auto w-full max-w-[868px]">
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "30px",
            boxShadow: "0px 4px 10px rgba(0,0,0,0.15)",
            padding: "20px 50px",
          }}
        >
          {/* Heading */}
          <div className="pt-6 text-center">
            <h2
              style={{
                fontFamily: "var(--font-red-hat-display), sans-serif",
                fontWeight: 600,
                fontSize: "60px",
                lineHeight: "60px",
                color: "#3a4a26",
                letterSpacing: "-1.5px",
              }}
            >
              FAQs
            </h2>
          </div>

          {/* FAQ list */}
          <div
            className="mt-14 border-t"
            style={{ borderColor: "rgba(31,42,22,0.12)" }}
          >
            {FAQS.map((faq, i) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
