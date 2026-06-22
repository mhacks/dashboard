"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const EASE = [0.25, 0.1, 0.25, 1] as const;

const KEY_DATES = [
  {
    iso: "2026-06-22",
    time: "12:00:00",
    date: "Jun. 22",
    label: "Applications Open",
  },
  { iso: "2026-08-07", date: "Aug. 07", label: "Early Application Deadline" },
  {
    iso: "2026-08-14",
    date: "Aug. 14",
    label: "Early Decisions Released",
  },
  {
    iso: "2026-09-12",
    date: "Sep. 12",
    label: "Regular Applications Deadline",
  },
  { iso: "2026-09-19", date: "Sep. 19", label: "Regular Decisions Released" },
];

function easternTime(iso: string, time = "00:00:00") {
  return new Date(`${iso}T${time}-04:00`).getTime();
}

function countdown(ms: number) {
  if (ms <= 0) return "Today";

  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);

  const unit = (n: number, name: string) =>
    `${n} ${name}${n === 1 ? "" : "s"}`;

  const parts: string[] = [];
  if (d) parts.push(unit(d, "day"));
  if (h) parts.push(unit(h, "hour"));
  if (m) parts.push(unit(m, "minute"));
  if (s) parts.push(unit(s, "second"));

  return `in ${parts.slice(0, 2).join(", ")}`;
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
  const nextIso =
    now === null
      ? undefined
      : KEY_DATES.find((k) => easternTime(k.iso, k.time) > now)?.iso;

  return (
    <section id="timeline" className="scroll-mt-20 px-5 py-24 md:px-10">
      <div className="mx-auto max-w-6xl" style={{ backgroundColor: "#f4f2e8" }}>
        <p
          className="font-red-hat text-sm md:text-base font-light uppercase tracking-[0.3em] flex items-center gap-2"
          style={{ color: "rgba(58,74,38,0.5)" }}
        >
          <span>◆</span>Applications<span>◆</span>
        </p>
        <h2
          className="mt-6 font-sans font-semibold text-4xl tracking-tight md:text-6xl"
          style={{ color: "#3A4A26" }}
        >
          Timeline
        </h2>

        <div
          className="mt-14 border-t"
          style={{ borderColor: "rgba(58,74,38,0.12)" }}
        >
          {KEY_DATES.map((item, i) => {
            const t = easternTime(item.iso, item.time);
            const isPast = now !== null && t <= now;
            const isNext = now !== null && item.iso === nextIso;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
                className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b px-2 py-6 transition-colors duration-300 md:px-4"
                style={{
                  borderColor: "rgba(58,74,38,0.12)",
                  opacity: isPast ? 0.4 : 1,
                  backgroundColor: "#f4f2e8",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(58,74,38,0.06)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f4f2e8")
                }
              >
                <span
                  className="w-20 font-mono text-base tracking-[0.1em]"
                  style={{ color: "rgba(58,74,38,0.6)" }}
                >
                  {item.date}
                </span>
                <h3
                  className="font-heading text-2xl italic md:text-4xl"
                  style={{ color: "#3A4A26" }}
                >
                  {item.label}
                </h3>
                <span
                  className="hidden flex-1 -translate-y-1.5 border-b border-dotted sm:block"
                  style={{ borderColor: "rgba(58,74,38,0.2)" }}
                />
                {isNext ? (
                  <span
                    className="rounded-full px-3 py-1 font-mono text-xs tracking-[0.12em] tabular-nums"
                    style={{ backgroundColor: "#3A4A26", color: "#f0efe6" }}
                  >
                    {countdown(t - now!)}
                  </span>
                ) : (
                  <span
                    className="rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.15em]"
                    style={{
                      borderColor: "rgba(58,74,38,0.2)",
                      color: "rgba(58,74,38,0.55)",
                    }}
                  >
                    {isPast ? "Passed" : "Upcoming"}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
