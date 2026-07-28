"use client";

import { useRef, useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { SplitReveal } from "@/components/landing/SplitReveal";
import { FaqItem } from "@/components/landing/FaqItem";
import { FlowerStamps } from "@/components/landing/FlowerStamps";
import { SpeciesLabel } from "@/components/landing/SpeciesLabel";
import { asset } from "@/lib/landing/asset";
import { StackedSheet } from "@/components/landing/StackedSheet";
import { formatDeadlineDate } from "@/lib/landing/deadlines";

const earlyAppsDue = formatDeadlineDate("early-apps-due");
const regularAppsDue = formatDeadlineDate("regular-apps-due");

const FAQS = [
  {
    q: "Who can apply?",
    a: "Any current undergraduate or graduate student is welcome to apply. You don't need to be a CS major. First-time hackers, designers, hardware tinkerers, and builders are all welcome. If you are looking to build something meaningful, you are encouraged to apply.",
  },
  {
    q: "Is there a cost to attend?",
    a: "No, MHacks is free for accepted hackers, including meals and swag. Travel reimbursement is available on a limited basis. We do not provide living accommodations, but the hacking location will be open 24 hours.",
  },
  {
    q: "Do I need a team?",
    a: "Nope, you can apply solo or form a team of up to four. We will host a team matching session on the first day of the hackathon.",
  },
  {
    q: "What should I build?",
    a: "Anything pertaining to our upcoming tracks. Past projects have spanned AI agents, hardware, wearables, climate tools, games, creative installations, and more. Sponsor tracks offer focused prize categories.",
  },
  {
    q: "When do applications close?",
    a: `Early applications are due ${earlyAppsDue}, and regular applications are due ${regularAppsDue}. Decisions will be out approximately one week after each deadline.`,
  },
  {
    q: "Where does the event happen?",
    a: "North Campus of the University of Michigan in Ann Arbor. Detailed venue and logistics will become public as we get closer to the event date.",
  },
];

export function Faq() {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const [openItem, setOpenItem] = useState("");

  // Violets zoom into existence as the sheet scrolls into place — staggered
  // so they bloom one after another. Scroll-linked scale, transform-only.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start start"],
  });
  const bloom1 = useTransform(scrollYProgress, [0.35, 0.8], [0, 1]);
  const bloom2 = useTransform(scrollYProgress, [0.45, 0.9], [0, 1]);
  const bloom3 = useTransform(scrollYProgress, [0.55, 1], [0, 1]);

  const violets = [
    {
      src: asset("/faq/flower-1.webp"),
      width: 152,
      scale: bloom1,
      sway: 5,
      drift: -3.5,
    },
    {
      src: asset("/faq/flower-2.webp"),
      width: 120,
      scale: bloom2,
      sway: 6.2,
      drift: 4,
    },
    {
      src: asset("/faq/flower-3.webp"),
      width: 138,
      scale: bloom3,
      sway: 5.6,
      drift: -4.5,
    },
  ];

  return (
    <StackedSheet
      ref={ref}
      id="faq"
      className="z-[9] min-h-screen bg-[#FBFAF4] px-6 md:px-[8vw] pt-24 pb-32 md:pt-32 md:pb-[260px]"
      style={{
        backgroundImage:
          "radial-gradient(rgba(58,74,38,0.16) 1px, transparent 1.4px)",
        backgroundSize: "26px 26px",
      }}
    >
      <FlowerStamps tone="light" />

      <div className="grid gap-14 md:grid-cols-[0.7fr_1.3fr] items-stretch">
        <div className="flex flex-col justify-between gap-10">
          <h2
            className="font-display font-medium text-moss-700"
            style={{
              fontSize: "clamp(30px, 4vw, 48px)",
              lineHeight: 1.15,
              letterSpacing: "-0.015em",
            }}
          >
            <span className="flex flex-wrap items-center gap-3">
              <SplitReveal as="span" className="block">
                {"Frequently Asked Questions"}
              </SplitReveal>
              <span
                aria-hidden
                className="font-mono text-[0.42em] tracking-[0.08em] text-moss-500"
              >
                {"°❀⋆"}
              </span>
            </span>
          </h2>

          {/* Decorative vertical polaroids pinned between heading and contact.
              The back one peeks out to the left; hovering either brings it to
              the top of the pile. */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
            viewport={{ once: true, amount: 0.4 }}
            className="hidden justify-center py-12 md:flex"
          >
            <div className="relative">
              <motion.div
                data-cursor="hover"
                style={{ rotate: 6, boxShadow: "0 0 0 rgba(29,36,18,0)" }}
                whileHover={{
                  scale: 1.06,
                  rotate: 1,
                  boxShadow: "0 26px 60px rgba(29,36,18,0.28)",
                }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="absolute -left-[115px] top-5 z-0 w-[180px] bg-white p-3 pb-4 hover:z-10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset("/faq/polaroid-1.jpg")}
                  alt=""
                  draggable={false}
                  className="h-[225px] w-full object-cover"
                />
                <div className="mt-3 text-center font-serif-it text-[15px] text-moss-700">
                  apply today
                </div>
              </motion.div>

              <motion.div
                data-cursor="hover"
                style={{ rotate: -3, boxShadow: "0 0 0 rgba(29,36,18,0)" }}
                whileHover={{
                  scale: 1.05,
                  rotate: 1.5,
                  boxShadow: "0 26px 60px rgba(29,36,18,0.28)",
                }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="relative z-[1] w-[200px] bg-white p-3 pb-4 hover:z-10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset("/faq/polaroid-2.jpg")}
                  alt=""
                  draggable={false}
                  className="h-[250px] w-full object-cover"
                />
                <div className="mt-3 text-center font-serif-it text-[15px] text-moss-700">
                  see you soon
                </div>
              </motion.div>
            </div>
          </motion.div>

          <p className="max-w-[340px] text-[15px] leading-[1.6] text-[#4d5942]">
            Can&rsquo;t find what you&rsquo;re looking for? Email us at{" "}
            <a
              href="mailto:hello@mhacks.org"
              className="text-moss-700 underline underline-offset-4 hover:text-moss-800"
              data-cursor="hover"
            >
              hello@mhacks.org
            </a>
            .
          </p>
        </div>

        {/* Single-open: expanding one answer collapses the previous, so the
            sheet's height stays consistent and can't crash into the violets */}
        <Accordion
          type="single"
          collapsible
          value={openItem}
          onValueChange={setOpenItem}
          className="flex flex-col gap-2"
        >
          {FAQS.map((f, i) => (
            <FaqItem key={f.q} value={`item-${i}`} q={f.q} a={f.a} />
          ))}
        </Accordion>
      </div>

      {/* Violet trio anchored to the section's bottom edge, beneath the
          questions — when an answer expands and the sheet grows, they ride
          down with the bottom. Each blooms in on scroll, then idles with its
          own slow sway. */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-2 top-4 flex origin-top-right scale-[0.38] items-end gap-8 md:bottom-[150px] md:right-[8vw] md:top-auto md:origin-bottom-right md:scale-100 md:gap-12"
      >
        {/* Species tag planted at the base of the trio */}
        <SpeciesLabel
          name="Dwarf Lake Iris"
          species="Iris lacustris"
          status="native · state wildflower"
          rotate={0}
          className="absolute -left-[260px] bottom-[28px] hidden md:flex"
        />
        {violets.map((v) => (
          <motion.div
            key={v.src}
            style={{
              scale: reduced ? 1 : v.scale,
              transformOrigin: "50% 100%",
            }}
          >
            <motion.img
              src={v.src}
              alt=""
              draggable={false}
              width={v.width}
              animate={
                reduced
                  ? undefined
                  : { rotate: [v.drift, -v.drift, v.drift], y: [-5, 6, -5] }
              }
              transition={{
                duration: v.sway,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        ))}
      </div>
    </StackedSheet>
  );
}
