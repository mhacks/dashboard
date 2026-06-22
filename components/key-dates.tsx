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
    <section id="timeline" className="scroll-mt-20 px-8 py-24 sm:px-12 md:px-16 lg:px-24">
      <div className="mx-auto max-w-6xl" style={{ backgroundColor: "#f4f2e8" }}>
        <p
          className="font-red-hat text-sm md:text-base font-light uppercase tracking-[0.3em] flex items-center gap-2"
          style={{ color: "rgba(58,74,38,0.5)" }}
        >
          <span>◆</span>Applications<span>◆</span>
        </p>
        <h2
          className="mt-6 font-sans font-normal text-3xl tracking-tight md:text-4xl lg:text-5xl"
          style={{ color: "#3A4A26" }}
        >
          Timeline
        </h2>

        <div
          className="mt-14 border-t"
          style={{ borderColor: "rgba(58,74,38,0.12)" }}
        >
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
                className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b px-2 py-5 transition-colors duration-300 md:px-4"
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
                  className="w-24 rounded-full border px-2.5 py-0.5 text-center font-mono text-[10px] uppercase tracking-[0.15em] md:w-28 md:px-3 md:py-1 md:text-xs"
                  style={
                    isActive
                      ? {
                          backgroundColor: "#3A4A26",
                          borderColor: "#3A4A26",
                          color: "#f0efe6",
                        }
                      : {
                          borderColor: "rgba(58,74,38,0.2)",
                          color: "rgba(58,74,38,0.55)",
                        }
                  }
                >
                  {status}
                </span>
                <h3
                  className="font-heading text-base md:text-xl"
                  style={{ color: "#3A4A26" }}
                >
                  {item.label}
                </h3>
                <span
                  className="hidden flex-1 -translate-y-1.5 border-b border-dotted sm:block"
                  style={{ borderColor: "rgba(58,74,38,0.2)" }}
                />
                <span
                  className="w-24 whitespace-nowrap text-right font-mono text-sm font-semibold tracking-[0.08em] md:w-28 md:text-base"
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
