"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/utils";

interface Props {
  text: string;
  /** ms before typing starts */
  delay?: number;
  /** ms per character */
  speed?: number;
  className?: string;
}

/**
 * Types text out character by character while holding the final layout: the
 * not-yet-typed remainder is rendered invisibly, so the block never moves or
 * re-centers as it types. A caret blinks at the type position until done.
 */
export function Typewriter({
  text,
  delay = 400,
  speed = 85,
  className,
}: Props) {
  const reducedMotion = prefersReducedMotion();
  const [n, setN] = useState(() => (reducedMotion ? text.length : 0));
  const done = n >= text.length;

  useEffect(() => {
    if (reducedMotion) return;
    let i = 0;
    let id = 0;
    const tick = () => {
      i++;
      setN(i);
      if (i < text.length) id = window.setTimeout(tick, speed);
    };
    id = window.setTimeout(tick, delay);
    return () => clearTimeout(id);
  }, [text, delay, speed, reducedMotion]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span aria-hidden className="relative">
        {!done && (
          <span className="type-caret absolute bottom-[0.06em] left-0 top-[0.12em] w-[0.045em] bg-current" />
        )}
        <span style={{ opacity: 0 }}>{text.slice(n)}</span>
      </span>
    </span>
  );
}
