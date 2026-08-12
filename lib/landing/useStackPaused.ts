"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * True while StackedPages has buried this sheet (`visibility: hidden`).
 * Use to stop infinite Framer Motion loops — display:none and visibility
 * alone do not pause JS-driven animations on sticky sheets that still sit
 * in the viewport geometrically.
 */
export function useStackPaused(ref: RefObject<HTMLElement | null>) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => setPaused(el.style.visibility === "hidden");

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, [ref]);

  return paused;
}
