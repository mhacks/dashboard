"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Click-to-stamp Michigan wildflowers. Mount inside any `position: relative`
 * section: clicks on the host section plant an ASCII flower at the cursor.
 * Stamps persist (capped) so the visitor can garden the page.
 *
 * The ASCII art is a placeholder — when the real flower SVGs arrive, swap the
 * <pre> for an <svg>/<img> per variant and keep the same spawn logic.
 */

const FLOWERS = [
  String.raw`\ | /
-(*)-
/ | \
  |`,
  String.raw` .-.
( ~ )
 '-'
  \|`,
  String.raw`\\_//
 \_/
  |
 \|/`,
  String.raw` * *
* + *
 * *
  |`,
  String.raw`  @
 \|/
--+--
  |`,
];

/* Species read differently against parchment vs. moss backgrounds. */
const LIGHT_BG_COLORS = ["#3A4A26", "#E07A9A", "#3A5AD4", "#5D6B3A", "#C08457"];
const DARK_BG_COLORS = ["#EFE9D4", "#E8D35A", "#E07A9A", "#C9E07A", "#7A93C9"];

const MAX_STAMPS = 60;

interface Stamp {
  id: number;
  x: number;
  y: number;
  art: string;
  color: string;
  rot: number;
  scale: number;
}

let nextId = 1;

export function FlowerStamps({ tone = "light" }: { tone?: "light" | "dark" }) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const host = overlay?.parentElement;
    if (!host) return;

    // Pointer-based tap detection instead of `click`: mobile browsers don't
    // always synthesize clicks for taps on non-interactive areas, and this
    // treats mouse and touch identically while ignoring scroll gestures.
    let down: { x: number; y: number; t: number; id: number } | null = null;

    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      down = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        id: e.pointerId,
      };
    };

    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const held = performance.now() - down.t;
      down = null;
      // A scroll/drag or long-press isn't a stamp request.
      if (moved > 12 || held > 600) return;
      // Don't stamp over real interactions (nav, accordion toggles, links…).
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("a, button, [role='button'], input, textarea, select")
      )
        return;

      const r = host.getBoundingClientRect();
      const colors = tone === "dark" ? DARK_BG_COLORS : LIGHT_BG_COLORS;
      setStamps((s) => [
        ...s.slice(-(MAX_STAMPS - 1)),
        {
          id: nextId++,
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          art: FLOWERS[Math.floor(Math.random() * FLOWERS.length)],
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: (Math.random() - 0.5) * 30,
          scale: 0.8 + Math.random() * 0.5,
        },
      ]);
    };

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointerup", onUp);
    return () => {
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
    };
  }, [tone]);

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[30] overflow-hidden"
    >
      {stamps.map((st) => (
        <motion.pre
          key={st.id}
          initial={{
            x: "-50%",
            y: "-50%",
            scale: 0,
            rotate: st.rot - 25,
            opacity: 0,
          }}
          animate={{
            x: "-50%",
            y: "-50%",
            scale: st.scale,
            rotate: st.rot,
            opacity: 1,
          }}
          transition={{ type: "spring", stiffness: 380, damping: 17 }}
          className="absolute select-none"
          style={{
            left: st.x,
            top: st.y,
            color: st.color,
            fontFamily: "var(--font-red-hat-mono), ui-monospace, monospace",
            fontSize: 12,
            lineHeight: 1.05,
          }}
        >
          {st.art}
        </motion.pre>
      ))}
    </div>
  );
}
