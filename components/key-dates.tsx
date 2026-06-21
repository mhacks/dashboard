"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const KEY_DATES = [
  {
    date: "June 22nd, 2026",
    label: "Hacker Applications Open",
    x: "33px",
    y: "348px",
    dateOffset: "8px",
    tone: "pink",
  },
  {
    date: "August 7th, 2026",
    label: "Early Applications Due",
    x: "331px",
    y: "378px",
    dateOffset: "8px",
    tone: "blue",
  },
  {
    date: "August 14th, 2026",
    label: "Early Decisions Released",
    x: "617px",
    y: "492px",
    dateOffset: "8px",
    tone: "pink",
  },
  {
    date: "September 12th, 2026",
    label: "Regular Applications Due",
    x: "864px",
    y: "606px",
    dateOffset: "8px",
    tone: "blue",
  },
  {
    date: "September 19th, 2026",
    label: "Regular Decisions Released",
    x: "1101px",
    y: "678px",
    dateOffset: "8px",
    tone: "pink",
  },
] as const;

const toneStyles = {
  pink: {
    labelBg: "#fde2f2",
    labelText: "#7f1140",
  },
  blue: {
    labelBg: "#d2e6ff",
    labelText: "#111f7f",
  },
};

function CornerSticker({
  label,
  tone,
  className,
  rotate,
  flip,
}: {
  label: string;
  tone: "pink" | "green";
  className: string;
  rotate: number;
  flip?: boolean;
}) {
  const styles =
    tone === "pink"
      ? { bg: "#fde2f2", text: "#7f1140" }
      : { bg: "#d6ff92", text: "#3a4a26" };

  return (
    <motion.div
      className={`pointer-events-none absolute z-20 hidden items-center gap-2 lg:flex ${className}`}
      initial={{ opacity: 0, y: -14, rotate: rotate - 6 }}
      whileInView={{
        opacity: 1,
        y: 0,
        rotate: [rotate - 6, rotate + 2, rotate - 1, rotate],
      }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 1.1, ease: EASE }}
    >
      {flip && (
        <span aria-hidden style={{ color: styles.bg }}>
          ⤸
        </span>
      )}
      <span
        className="font-red-hat px-4 py-1.5 text-[16px] font-bold shadow-[0_4px_2px_rgba(0,0,0,0.1)]"
        style={{ backgroundColor: styles.bg, color: styles.text }}
      >
        {label}
      </span>
      {!flip && (
        <span aria-hidden style={{ color: styles.bg }}>
          ⤴
        </span>
      )}
    </motion.div>
  );
}

function DateSticker({
  item,
  index,
}: {
  item: (typeof KEY_DATES)[number];
  index: number;
}) {
  const tone = toneStyles[item.tone];

  return (
    <motion.div
      className="relative flex flex-col items-start gap-1 md:absolute md:left-[var(--sticker-x)] md:top-[var(--sticker-y)]"
      style={
        {
          "--sticker-x": item.x,
          "--sticker-y": item.y,
          "--date-offset": item.dateOffset,
        } as CSSProperties
      }
      initial={{ opacity: 0, y: 14, rotate: -9 }}
      whileInView={{ opacity: 1, y: 0, rotate: -9 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay: 1.0 + index * 0.14, ease: EASE }}
    >
      <div
        className="font-red-hat w-max px-5 py-2.5 text-center text-[16px] font-bold shadow-[0_4px_2px_rgba(0,0,0,0.1)] md:text-[20px]"
        style={{ backgroundColor: tone.labelBg, color: tone.labelText }}
      >
        {item.label}
      </div>
      <div
        className="font-heading w-max px-5 py-2.5 text-center text-[20px] shadow-[0_4px_2px_rgba(0,0,0,0.1)] md:ml-[var(--date-offset)] md:text-[24px]"
        style={{ backgroundColor: "#fffbb5", color: "#76681a" }}
      >
        {item.date}
      </div>
    </motion.div>
  );
}

export default function KeyDates() {
  return (
    <section
      id="timeline"
      className="scroll-mt-20 relative overflow-hidden bg-[#f4f2e8] px-5 py-20 md:px-10 md:py-24"
    >
      <div className="relative mx-auto max-w-[1440px]">
        <CornerSticker
          label="Oct 3-4"
          tone="pink"
          rotate={-8}
          flip
          className="left-2 top-0 xl:left-10"
        />
        <CornerSticker
          label="Ann Arbor, MI"
          tone="green"
          rotate={7}
          className="right-2 top-0 xl:right-10"
        />
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative z-30 text-center"
        >
          <h2
            className="font-red-hat text-[clamp(3rem,6vw,3.75rem)] font-semibold leading-none tracking-[-0.025em]"
            style={{ color: "#3A4A26" }}
          >
            Application{" "}
            <span className="font-heading italic font-normal">Timeline</span>
          </h2>
          <p className="font-red-hat mx-auto mt-5 max-w-[531px] text-[13px] font-semibold leading-5 text-black/50">
            Did you know: <span className="italic">Wild</span> Lily of the
            Valley is highly native to Michigan. Common Lily of the Valley,
            however, is classified as invasive and aggressive.
          </p>
        </motion.div>

        <div className="relative mt-12 min-h-[760px] md:mt-6 md:min-h-[910px]">
          <motion.img
            src="/timeline-flower.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[37%] w-[1120px] max-w-none origin-top -translate-x-1/2 -translate-y-1/2 select-none md:w-[1510px]"
            initial={{ y: -12, rotate: -9.3 }}
            whileInView={{
              y: [16, -4, 2, 0],
              rotate: [-9.3, -6.4, -8.6, -7.2, -8, -7.68],
            }}
            viewport={{ once: true, amount: 0.32 }}
            transition={{ duration: 2.1, ease: [0.34, 1.2, 0.64, 1] }}
          />

          <div className="relative z-10 grid gap-6 pt-[360px] md:block md:pt-0">
            {KEY_DATES.map((item, index) => (
              <DateSticker key={item.label} item={item} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
