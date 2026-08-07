"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/utils";

interface Props {
  text: string;
  /** ms before typing starts */
  delay?: number;
  /** ms per character */
  speed?: number;
  className?: string;
  showCaret?: boolean;
  /** After the first reveal, show text updates immediately (for live labels). */
  freezeAfterComplete?: boolean;
  /** Fires once when the full string is visible. */
  onComplete?: () => void;
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
  showCaret = true,
  freezeAfterComplete = false,
  onComplete,
}: Props) {
  const reducedMotion = prefersReducedMotion();
  const [n, setN] = useState(0);
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const visible = reducedMotion ? text.length : n;
  const done = visible >= text.length;

  useEffect(() => {
    if (reducedMotion) {
      completed.current = true;
      onCompleteRef.current?.();
      return;
    }

    let tickId = 0;
    let cancelled = false;

    if (freezeAfterComplete && completed.current) {
      tickId = window.setTimeout(() => {
        if (!cancelled) setN(text.length);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(tickId);
      };
    }

    completed.current = false;
    let i = 0;

    const tick = () => {
      if (cancelled) return;
      i++;
      setN(i);
      if (i < text.length) {
        tickId = window.setTimeout(tick, speed);
      } else {
        completed.current = true;
        onCompleteRef.current?.();
      }
    };

    tickId = window.setTimeout(() => {
      if (cancelled) return;
      setN(0);
      tickId = window.setTimeout(tick, delay);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(tickId);
    };
  }, [text, delay, speed, reducedMotion, freezeAfterComplete]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, visible)}</span>
      <span aria-hidden className="relative">
        {!done && showCaret && (
          <span className="type-caret absolute bottom-[0.06em] left-0 top-[0.12em] w-[0.045em] bg-current" />
        )}
        <span style={{ opacity: 0 }}>{text.slice(visible)}</span>
      </span>
    </span>
  );
}
