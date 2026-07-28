"use client";

import { useEffect, useState } from "react";
import { getNextDeadline, getTimeParts } from "@/lib/landing/deadlines";

/**
 * Live countdown pill to the next application deadline (see lib/deadlines.ts
 * for the schedule and backend handoff notes). Ticks every second. Renders an
 * invisible placeholder until mounted so the server and client markup match,
 * and renders nothing once every deadline has passed.
 */
export function DeadlineCountdown({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  // Typewriter entrance: characters revealed one by one on mount, then the
  // timer just ticks in place.
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const typer = setInterval(() => {
      setTyped((c) => {
        if (c >= 80) {
          clearInterval(typer);
          return c;
        }
        return c + 1;
      });
    }, 24);
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    return () => {
      clearInterval(id);
      clearInterval(typer);
      clearTimeout(initial);
    };
  }, []);

  const next = now ? getNextDeadline(now) : null;

  // Pre-mount (SSR + first client render): reserve the pill's height so the
  // hero lockup doesn't shift when the timer appears.
  if (!now) return <div aria-hidden className="h-[30px]" />;
  if (!next) return null;

  const t = getTimeParts(new Date(next.date), now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const full = `${next.countdownLabel} in ${t.days}d ${pad(t.hours)}h ${pad(t.minutes)}m ${pad(t.seconds)}s`;

  return (
    <div
      role="timer"
      aria-label={`${next.countdownLabel} in ${t.days} days, ${t.hours} hours, ${t.minutes} minutes`}
      // backdrop-blur only at md+: repainting a blurred backdrop every tick
      // made the pill stutter on phones.
      className={`inline-flex items-center rounded-pill border border-white/40 bg-[rgba(24,24,24,0.55)] px-3 py-1.5 md:bg-[rgba(24,24,24,0.5)] md:px-4 md:backdrop-blur-sm ${className ?? ""}`}
    >
      <span
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#f2f2f2] md:text-[11px] md:tracking-[0.18em]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {full.slice(0, typed)}
      </span>
    </div>
  );
}
