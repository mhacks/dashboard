"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeScroll } from "@/lib/landing/scroll";

interface Options {
  /** Minimum scroll delta before toggling direction. */
  threshold?: number;
  /** Scroll Y after which hide-on-scroll-down activates. */
  minScroll?: number;
}

/**
 * Tracks scroll direction for Mercury-style sticky nav: hide when scrolling
 * down, reveal when scrolling up.
 */
export function useScrollDirection({
  threshold = 8,
  minScroll = 64,
}: Options = {}) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      lastY.current = y;

      if (Math.abs(delta) < threshold) return;

      if (y < minScroll) {
        setVisible(true);
      } else if (delta > 0) {
        setVisible(false);
      } else {
        setVisible(true);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const unsubLenis = subscribeScroll(onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      unsubLenis();
    };
  }, [threshold, minScroll]);

  return visible;
}
