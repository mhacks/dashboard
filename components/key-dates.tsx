"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const EASE = [0.25, 0.1, 0.25, 1] as const;

const KEY_DATES = [
  { iso: "2026-06-22", date: "Jun. 22", label: "Applications Open" },
  { iso: "2026-08-07", date: "Aug. 07", label: "Early Application Deadline" },
  { iso: "2026-08-14", date: "Aug. 14", label: "Early Decisions Released" },
  { iso: "2026-09-12", date: "Sep. 12", label: "Regular Applications Deadline" },
  { iso: "2026-09-19", date: "Sep. 19", label: "Regular Decisions Released" },
];

const NOTES = [
  { label: "Hacker Applications Open", date: "June 22nd, 2026", type: "pink", left: "4.2%", top: "57%" },
  { label: "Early Applications Due", date: "August 7th, 2026", type: "blue", left: "22.4%", top: "65%" },
  { label: "Early Decisions Released", date: "August 14th, 2026", type: "pink", left: "36.7%", top: "73%" },
  { label: "Regular Applications Due", date: "September 12th, 2026", type: "blue", left: "53.5%", top: "80%" },
  { label: "Regular Decisions Released", date: "September 19th, 2026", type: "pink", left: "76.7%", top: "83%" },
] as const;

function easternDateKey(ms: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function timelineStatus(iso: string, now: number | null) {
  if (now === null) return "Upcoming";

  const today = easternDateKey(now);
  const yesterday = easternDateKey(now - 86_400_000);
  const tomorrow = easternDateKey(now + 86_400_000);

  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  if (iso === yesterday) return "Yesterday";
  return iso < today ? "Passed" : "Upcoming";
}

function useNow() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const initialId = window.setTimeout(updateNow, 0);
    const intervalId = window.setInterval(updateNow, 1000);

    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(intervalId);
    };
  }, []);

  return now;
}

export default function KeyDates() {
  const now = useNow();

  return (
    <section
      id="timeline"
      className="relative scroll-mt-20 overflow-hidden"
      style={{ minHeight: "900px", backgroundColor: "#f4f2e8" }}
    >
      {/* Lily illustration + ASCII overlay (desktop) */}
      {/* mix-blend-mode:multiply makes the cream bg transparent, keeps green/pink visible */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/timeline_lily.png"
        alt=""
        aria-hidden
        className="pointer-events-none select-none hidden lg:block absolute"
        style={{
          width: "115%",
          height: "auto",
          left: "-7.5%",
          top: "-2%",
          transform: "rotate(-6.83deg)",
          transformOrigin: "50% 50%",
          mixBlendMode: "multiply",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/timeline_ascii.png"
        alt=""
        aria-hidden
        className="pointer-events-none select-none hidden lg:block absolute"
        style={{
          width: "115%",
          height: "auto",
          left: "-7.5%",
          top: "-4%",
          transform: "rotate(-7.68deg)",
          transformOrigin: "50% 50%",
          mixBlendMode: "multiply",
        }}
      />

      {/* Gradient fades */}
      <div className="hidden lg:block absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#f4f2e8] to-transparent pointer-events-none z-[5]" />
      <div className="hidden lg:block absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#f4f2e8] to-transparent pointer-events-none z-[5]" />

      {/* Heading (all sizes) */}
      <div className="relative z-10 flex flex-col items-center text-center pt-16 lg:pt-20 px-8 sm:px-12 md:px-16">
        <h2
          className="font-red-hat font-semibold text-4xl tracking-[-1.5px] md:text-5xl lg:text-[60px]"
          style={{ color: "#3A4A26" }}
        >
          Application{" "}
          <span className="font-heading italic">Timeline</span>
        </h2>
        <p className="mt-4 font-red-hat font-semibold text-[13px] text-black opacity-50 max-w-[531px] leading-[20px]">
          Did you know:{" "}
          <span className="font-semibold italic">Wild</span>
          {" "}Lily of the Valley (pictured below) is a species{" "}
          <span className="font-semibold italic">highly</span>
          {" "}native to Michigan.{" "}
          <span className="font-semibold italic">Common</span>
          {" "}Lily of the Valley, however, is classified as invasive and aggressive.
        </p>
      </div>

      {/* Desktop: cursor labels + sticky note pairs */}
      <div className="hidden lg:block">
        {/* "Oct 3-4" cursor label */}
        <div
          className="absolute z-20"
          style={{ left: "9%", top: "25%", transform: "rotate(-6.69deg)" }}
        >
          <div
            className="border-2 border-black px-8 py-2.5"
            style={{ backgroundColor: "#ef7daf", borderRadius: "20px 20px 20px 0px" }}
          >
            <p className="text-white text-2xl font-normal whitespace-nowrap">Oct 3-4</p>
          </div>
        </div>

        {/* "Ann Arbor, MI" cursor label */}
        <div
          className="absolute z-20"
          style={{ left: "79%", top: "12%", transform: "rotate(14.27deg)" }}
        >
          <div
            className="border-2 border-black px-5 py-2.5"
            style={{ backgroundColor: "#d2f775", borderRadius: "20px 0px 20px 20px" }}
          >
            <p className="text-black text-2xl font-normal whitespace-nowrap">Ann Arbor, MI</p>
          </div>
        </div>

        {/* Sticky note pairs */}
        {NOTES.map((note) => (
          <div
            key={note.label}
            className="absolute z-20 flex flex-col"
            style={{ left: note.left, top: note.top, gap: "6px" }}
          >
            <div
              className="px-5 py-2.5"
              style={{
                backgroundColor: note.type === "pink" ? "#fde2f2" : "#d2e6ff",
                transform: "rotate(-9deg)",
                boxShadow: "0px 4px 8px rgba(0,0,0,0.12)",
              }}
            >
              <p
                className="font-red-hat font-bold text-xl text-center whitespace-nowrap"
                style={{ color: note.type === "pink" ? "#7f1140" : "#111f7f" }}
              >
                {note.label}
              </p>
            </div>
            <div
              className="px-5 py-2.5"
              style={{
                backgroundColor: "#fffbb5",
                transform: "rotate(-9deg)",
                boxShadow: "0px 4px 8px rgba(0,0,0,0.12)",
              }}
            >
              <p className="font-heading text-2xl text-center whitespace-nowrap" style={{ color: "#76681a" }}>
                {note.date}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: traditional list */}
      <div className="lg:hidden relative z-10 mx-auto max-w-3xl px-8 sm:px-12 mt-10 pb-16">
        <div className="border-t" style={{ borderColor: "rgba(58,74,38,0.12)" }}>
          {KEY_DATES.map((item, i) => {
            const status = timelineStatus(item.iso, now);
            const isActive = status === "Today";
            const isPast = status === "Yesterday" || status === "Passed";
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b px-2 py-5"
                style={{
                  borderColor: "rgba(58,74,38,0.12)",
                  opacity: isPast ? 0.4 : 1,
                }}
              >
                <span
                  className="w-24 rounded-full border px-2.5 py-0.5 text-center font-mono text-xs uppercase tracking-[0.15em]"
                  style={
                    isActive
                      ? { backgroundColor: "#3A4A26", borderColor: "#3A4A26", color: "#f0efe6" }
                      : { borderColor: "rgba(58,74,38,0.2)", color: "rgba(58,74,38,0.55)" }
                  }
                >
                  {status}
                </span>
                <h3 className="font-heading text-lg" style={{ color: "#3A4A26" }}>
                  {item.label}
                </h3>
                <span
                  className="hidden flex-1 -translate-y-1.5 border-b border-dotted sm:block"
                  style={{ borderColor: "rgba(58,74,38,0.2)" }}
                />
                <span
                  className="font-mono text-base font-semibold tracking-[0.08em]"
                  style={{ color: "rgba(58,74,38,0.6)" }}
                >
                  {item.date}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
