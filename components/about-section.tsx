"use client";

import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

function SideFlower({
  src,
  side,
  initialRotate,
  settleRotate,
  className,
}: {
  src: string;
  side: "left" | "right";
  initialRotate: number;
  settleRotate: number;
  className: string;
}) {
  const fromX = side === "left" ? -54 : 54;

  return (
    <motion.img
      src={src}
      alt=""
      aria-hidden
      initial={{ opacity: 0, x: fromX, y: -28, rotate: initialRotate }}
      whileInView={{ opacity: 1, x: 0, y: 0, rotate: settleRotate }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 1.45, ease: EASE }}
      className={`pointer-events-none absolute hidden select-none lg:block ${className}`}
    />
  );
}

export default function AboutSection() {
  return (
    <section
      id="about"
      className="scroll-mt-20 relative overflow-hidden bg-[#f4f2e8]"
    >
      <div className="pointer-events-none absolute -left-36 top-4 hidden size-[420px] rounded-full bg-[#c4febe]/50 blur-3xl lg:block" />
      <div className="pointer-events-none absolute -right-20 top-0 hidden size-[360px] rounded-full bg-[#ffbce1]/45 blur-3xl lg:block" />

      <SideFlower
        src="/about-neon-flower-left.png"
        side="left"
        initialRotate={29}
        settleRotate={33}
        className="left-[-110px] top-[-16px] w-[455px]"
      />
      <SideFlower
        src="/about-neon-flower-right.png"
        side="right"
        initialRotate={-30}
        settleRotate={-26}
        className="right-[-75px] top-[2px] w-[415px]"
      />

      <div className="relative flex flex-col items-center px-8 pb-20 pt-24 sm:px-12 lg:px-16 lg:pb-28 lg:pt-[100px]">
        <p
          className="font-red-hat mb-1.5 text-center text-[18px] font-semibold leading-[1.3]"
          style={{ color: "rgba(0,0,0,0.5)" }}
        >
          About MHacks
        </p>
        <h2
          className="text-center text-[clamp(3rem,6vw,4.5rem)] leading-[1.1] tracking-[-0.035em]"
          style={{ color: "#3A4A26" }}
        >
          <span className="font-red-hat font-semibold">Calling All</span>{" "}
          <span className="font-heading italic">Hackers</span>
        </h2>

        <div
          className="font-red-hat mt-10 flex max-w-[641px] flex-col gap-9 text-left text-[18px] font-medium leading-[1.5] sm:text-[20px]"
          style={{ color: "#262626" }}
        >
          <p>
            MHacks is the University of Michigan&apos;s flagship hackathon,
            bringing together the brightest student minds from across the
            country.
            <br />
            <br />
            Over 24 hours, you&apos;ll collaborate, create, and compete for over
            $40,000 in prizes.
          </p>
          <p>
            Whether you are a seasoned hacker or attending your first hackathon,
            MHacks is the place to turn your wildest ideas into reality.
            <br />
            <br />
            Join us for a weekend of innovation, mentorship, and community.
          </p>
        </div>
      </div>
    </section>
  );
}
