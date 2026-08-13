"use client";

import { useEffect, useState } from "react";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { useInView } from "@/lib/landing/useInView";

/**
 * The ASCII flower beside the "click around the canvas" hint. It blooms
 * through a few frames once it scrolls into view — a small tell that this
 * corner of the section is playful — and replays with a color lift on hover.
 * Every frame is the same 5x3 character grid, so swapping never shifts layout.
 */
const FRAMES = [
  "  .  \n-( )-\n  '  ",
  ". | .\n-(o)-\n' | '",
  "\\ | /\n-(*)-\n/ | \\",
];

const FRAME_MS = 220;

export function AsciiBloom({ className }: { className?: string }) {
  const { ref, inView } = useInView<HTMLPreElement>();
  const [frame, setFrame] = useState(0);
  // Bumping the cycle restarts the bloom (hover replays it).
  const [cycle, setCycle] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    const reset = window.setTimeout(() => setFrame(0), 0);
    const id = setInterval(() => {
      setFrame((f) => {
        if (f >= FRAMES.length - 1) {
          clearInterval(id);
          return f;
        }
        return f + 1;
      });
    }, FRAME_MS);
    return () => {
      clearTimeout(reset);
      clearInterval(id);
    };
  }, [inView, cycle]);

  const displayFrame =
    inView && prefersReducedMotion() ? FRAMES.length - 1 : frame;

  return (
    <pre
      ref={ref}
      aria-hidden
      data-cursor="hover"
      onMouseEnter={() => {
        setHovered(true);
        if (!prefersReducedMotion()) setCycle((c) => c + 1);
      }}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "select-none transition-colors duration-300",
        hovered ? "text-moss-700" : "text-moss-500",
        className,
      )}
    >
      {FRAMES[displayFrame]}
    </pre>
  );
}
