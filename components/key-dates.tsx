"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const EASE = [0.25, 0.1, 0.25, 1] as const;

const KEY_DATES = [
  { iso: "2026-06-22", date: "Jun. 22", label: "Applications Open" },
  { iso: "2026-08-07", date: "Aug. 07", label: "Early Application Deadline" },
  { iso: "2026-08-21", date: "Aug. 21", label: "Early Decisions Released" },
  { iso: "2026-09-04", date: "Sep. 04", label: "Regular Applications Deadline" },
  { iso: "2026-09-11", date: "Sep. 11", label: "Regular Decisions Released" },
];

function midnightEastern(iso: string) {
  return new Date(`${iso}T00:00:00-04:00`).getTime();
}

function countdown(ms: number) {
  if (ms <= 0) return "T–00:00:00";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `T–${d}D ${pad(h)}:${pad(m)}:${pad(s)}`;
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
      : KEY_DATES.find((k) => midnightEastern(k.iso) > now)?.iso;

  return (
    <section id="timeline" className="scroll-mt-20 px-5 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <p
          className="text-[11px] font-light uppercase tracking-[0.3em] flex items-center gap-2"
          style={{ color: "rgba(58,74,38,0.5)" }}
        >
          <span>◆</span>Applications<span>◆</span>
        </p>
        <h2
          className="mt-6 font-sans font-semibold text-4xl tracking-tight md:text-6xl"
          style={{ color: "#3A4A26" }}
        >
          Mark your{" "}
          <span className="font-heading italic" style={{ color: "rgba(58,74,38,0.6)" }}>
            calendar.
          </span>
        </h2>

        <div className="mt-14 border-t" style={{ borderColor: "rgba(58,74,38,0.12)" }}>
          {KEY_DATES.map((item, i) => {
            const t = midnightEastern(item.iso);
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
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(58,74,38,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <span
                  className="w-16 font-mono text-sm tracking-[0.1em]"
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
                    className="rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.12em] tabular-nums"
                    style={{ backgroundColor: "#3A4A26", color: "#f0efe6" }}
                  >
                    {countdown(t - now)}
                  </span>
                ) : (
                  <span
                    className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
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
